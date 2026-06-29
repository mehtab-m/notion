const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const Note = require('../models/Note');
const upload = require('../middleware/upload');

// GET all books
router.get('/', async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create book — auto-creates a linked notebook
router.post('/', upload.single('coverImage'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.coverImage = '/uploads/' + req.file.filename;
    }
    const book = new Book(data);
    const saved = await book.save();

    const notebook = new Note({
      title: saved.title,
      isNotebook: true,
      bookId: saved._id,
      folder: 'Books',
      tags: ['book-notebook'],
    });
    const savedNotebook = await notebook.save();

    saved.notebookId = savedNotebook._id;
    await saved.save();

    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET single book
router.get('/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH increment page
router.patch('/:id/increment-page', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
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

// POST learning line — saves to book's notebook
router.post('/:id/learning-line', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
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
      });
      const savedNotebook = await notebook.save();
      notebookId = savedNotebook._id;
      book.notebookId = notebookId;
      await book.save();
    }

    const pageCount = await Note.countDocuments({ notebookId, isNotebook: false });
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
    });
    const saved = await page.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update book
router.put('/:id', upload.single('coverImage'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.coverImage = '/uploads/' + req.file.filename;
    }
    const updated = await Book.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ error: 'Book not found' });

    if (updated.notebookId && data.title) {
      await Note.findByIdAndUpdate(updated.notebookId, { title: data.title, updatedAt: Date.now() });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE book
router.delete('/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    if (book.notebookId) {
      await Note.deleteMany({ notebookId: book.notebookId });
      await Note.findByIdAndDelete(book.notebookId);
    }
    await Book.findByIdAndDelete(req.params.id);
    res.json({ message: 'Book deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
