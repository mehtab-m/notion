const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const Note = require('../models/Note');
const upload = require('../middleware/upload');
const { owned } = require('../utils/scope');

router.get('/', async (req, res) => {
  try {
    const books = await Book.find(owned(req)).sort({ createdAt: -1 });
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', upload.single('coverImage'), async (req, res) => {
  try {
    const data = { ...req.body, userId: req.user._id };
    if (req.file) data.coverImage = '/uploads/' + req.file.filename;
    const book = new Book(data);
    const saved = await book.save();

    const notebook = new Note({
      title: saved.title,
      isNotebook: true,
      bookId: saved._id,
      folder: 'Books',
      tags: ['book-notebook'],
      userId: req.user._id,
    });
    const savedNotebook = await notebook.save();
    saved.notebookId = savedNotebook._id;
    await saved.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const book = await Book.findOne(owned(req, { _id: req.params.id }));
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/increment-page', async (req, res) => {
  try {
    const book = await Book.findOne(owned(req, { _id: req.params.id }));
    if (!book) return res.status(404).json({ error: 'Book not found' });
    const increment = parseInt(req.body.increment, 10) || 1;
    book.currentPage = Math.min(
      (book.currentPage || 0) + increment,
      book.totalPages > 0 ? book.totalPages : Infinity
    );
    if (book.status === 'want-to-read' && book.currentPage > 0) {
      book.status = 'reading';
      if (!book.startedAt) book.startedAt = new Date();
    }
    if (book.totalPages > 0 && book.currentPage >= book.totalPages) {
      book.currentPage = book.totalPages;
      book.status = 'completed';
      if (!book.finishedAt) book.finishedAt = new Date();
    }
    await book.save();
    res.json(book);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/learning-line', async (req, res) => {
  try {
    const book = await Book.findOne(owned(req, { _id: req.params.id }));
    if (!book) return res.status(404).json({ error: 'Book not found' });
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });

    let notebookId = book.notebookId;
    if (!notebookId) {
      const notebook = new Note({
        title: book.title,
        isNotebook: true,
        bookId: book._id,
        folder: 'Books',
        tags: ['book-notebook'],
        userId: req.user._id,
      });
      const savedNotebook = await notebook.save();
      notebookId = savedNotebook._id;
      book.notebookId = notebookId;
      await book.save();
    }

    const pageCount = await Note.countDocuments(owned(req, { notebookId, isNotebook: false }));
    const page = new Note({
      title: `Learning · p.${book.currentPage || '?'}`,
      content: text.trim(),
      blocks: [{ type: 'text', content: text.trim(), order: 0 }],
      isNotebook: false,
      notebookId,
      parentId: notebookId,
      bookId: book._id,
      folder: 'Books',
      tags: ['learning-line'],
      order: pageCount,
      userId: req.user._id,
    });
    const saved = await page.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', upload.single('coverImage'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.coverImage = '/uploads/' + req.file.filename;
    const updated = await Book.findOneAndUpdate(owned(req, { _id: req.params.id }), data, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ error: 'Book not found' });
    if (updated.notebookId && data.title) {
      await Note.findOneAndUpdate(
        owned(req, { _id: updated.notebookId }),
        { title: data.title, updatedAt: Date.now() }
      );
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const book = await Book.findOne(owned(req, { _id: req.params.id }));
    if (!book) return res.status(404).json({ error: 'Book not found' });
    if (book.notebookId) {
      await Note.deleteMany(owned(req, { notebookId: book.notebookId }));
      await Note.findOneAndDelete(owned(req, { _id: book.notebookId }));
    }
    await Book.findOneAndDelete(owned(req, { _id: req.params.id }));
    res.json({ message: 'Book deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
