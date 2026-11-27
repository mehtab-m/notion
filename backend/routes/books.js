const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const upload = require('../middleware/upload');
const { owned } = require('../utils/scope');
const { active, notTrashed } = require('../utils/lifecycle');
const { cleanBody, num } = require('../utils/body');
const { serialize } = require('../utils/serialize');
const { resolveImageField } = require('../utils/mediaUrl');

/* Cover image and the book's PDF arrive in the same multipart request. */
const bookUpload = upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'pdfFile', maxCount: 1 },
]);

function bookData(body, files = {}) {
  const file = files.coverImage?.[0];
  const pdf = files.pdfFile?.[0];
  const data = cleanBody(body);
  if (pdf) {
    if (pdf.mimetype !== 'application/pdf' && !/\.pdf$/i.test(pdf.originalname)) {
      const err = new Error('Book file must be a PDF');
      err.status = 400;
      throw err;
    }
    data.pdfFile = '/uploads/' + pdf.filename;
  } else if (data.removePdf === 'true') {
    data.pdfFile = null;
  } else {
    delete data.pdfFile;
  }
  delete data.removePdf;
  const image = resolveImageField(data, file, {
    fileField: 'coverImage',
    urlFields: ['coverImageUrl', 'coverImage'],
  });
  if (!image.ok) {
    const err = new Error(image.error);
    err.status = 400;
    throw err;
  }
  if (image.value !== undefined) data.coverImage = image.value;
  delete data.coverImageUrl;

  if (data.currentPage != null) data.currentPage = num(data.currentPage, 0);
  if (data.totalPages != null) data.totalPages = num(data.totalPages, 0);
  if (data.rating != null) data.rating = num(data.rating, 0);
  return data;
}

router.get('/', async (req, res) => {
  try {
    const books = await prisma.book.findMany({
      where: active(req),
      orderBy: { createdAt: 'desc' },
    });
    res.json(serialize(books));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', bookUpload, async (req, res) => {
  try {
    const saved = await prisma.book.create({
      data: { ...bookData(req.body, req.files), userId: req.user.id },
    });

    const notebook = await prisma.note.create({
      data: {
        title: saved.title,
        isNotebook: true,
        bookId: saved.id,
        folder: 'Books',
        tags: ['book-notebook'],
        userId: req.user.id,
      },
    });

    const withNotebook = await prisma.book.update({
      where: { id: saved.id },
      data: { notebookId: notebook.id },
    });

    res.status(201).json(serialize(withNotebook));
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const book = await prisma.book.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json(serialize(book));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/increment-page', async (req, res) => {
  try {
    const book = await prisma.book.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!book) return res.status(404).json({ error: 'Book not found' });
    const increment = parseInt(req.body.increment, 10) || 1;
    let currentPage = Math.min(
      (book.currentPage || 0) + increment,
      book.totalPages > 0 ? book.totalPages : Infinity
    );
    let status = book.status;
    let startedAt = book.startedAt;
    let finishedAt = book.finishedAt;
    if (status === 'want-to-read' && currentPage > 0) {
      status = 'reading';
      if (!startedAt) startedAt = new Date();
    }
    if (book.totalPages > 0 && currentPage >= book.totalPages) {
      currentPage = book.totalPages;
      status = 'completed';
      if (!finishedAt) finishedAt = new Date();
    }
    const updated = await prisma.book.update({
      where: { id: book.id },
      data: { currentPage, status, startedAt, finishedAt },
    });
    res.json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/learning-line', async (req, res) => {
  try {
    const book = await prisma.book.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!book) return res.status(404).json({ error: 'Book not found' });
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });

    let notebookId = book.notebookId;
    if (!notebookId) {
      const notebook = await prisma.note.create({
        data: {
          title: book.title,
          isNotebook: true,
          bookId: book.id,
          folder: 'Books',
          tags: ['book-notebook'],
          userId: req.user.id,
        },
      });
      notebookId = notebook.id;
      await prisma.book.update({
        where: { id: book.id },
        data: { notebookId },
      });
    }

    const pageCount = await prisma.note.count({
      where: owned(req, { notebookId, isNotebook: false }),
    });
    const saved = await prisma.note.create({
      data: {
        title: `Learning · p.${book.currentPage || '?'}`,
        content: text.trim(),
        blocks: [{ type: 'text', content: text.trim(), order: 0 }],
        isNotebook: false,
        notebookId,
        parentId: notebookId,
        bookId: book.id,
        folder: 'Books',
        tags: ['learning-line'],
        order: pageCount,
        userId: req.user.id,
      },
    });
    res.status(201).json(serialize(saved));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', bookUpload, async (req, res) => {
  try {
    const existing = await prisma.book.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Book not found' });
    const data = bookData(req.body, req.files);
    const updated = await prisma.book.update({
      where: { id: existing.id },
      data,
    });
    if (updated.notebookId && data.title) {
      await prisma.note.updateMany({
        where: owned(req, { id: updated.notebookId }),
        data: { title: data.title },
      });
    }
    res.json(serialize(updated));
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const book = await prisma.book.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!book) return res.status(404).json({ error: 'Book not found' });
    const now = new Date();
    // The book's notebook and its pages follow it into the trash, so a
    // restore brings the reading notes back with it.
    if (book.notebookId) {
      await prisma.note.updateMany({
        where: owned(req, { notebookId: book.notebookId, deletedAt: null }),
        data: { deletedAt: now },
      });
      await prisma.note.updateMany({
        where: owned(req, { id: book.notebookId, deletedAt: null }),
        data: { deletedAt: now },
      });
    }
    await prisma.book.update({
      where: { id: book.id },
      data: { deletedAt: now, archivedAt: null },
    });
    res.json({ message: 'Book moved to trash', _id: book.id, type: 'book' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
