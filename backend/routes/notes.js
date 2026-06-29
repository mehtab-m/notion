const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const upload = require('../middleware/upload');
const { owned } = require('../utils/scope');

router.get('/', async (req, res) => {
  try {
    const { notebookId, parentId, isNotebook } = req.query;
    const filter = owned(req);
    if (notebookId) filter.notebookId = notebookId;
    if (parentId !== undefined) filter.parentId = parentId === 'null' ? null : parentId;
    if (isNotebook !== undefined) filter.isNotebook = isNotebook === 'true';
    const notes = await Note.find(filter).sort({ order: 1, pinned: -1, updatedAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    res.json({ imageUrl: '/uploads/' + req.file.filename });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const note = new Note({ ...req.body, userId: req.user._id });
    const saved = await note.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const note = await Note.findOne(owned(req, { _id: req.params.id }));
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/children', async (req, res) => {
  try {
    const parent = await Note.findOne(owned(req, { _id: req.params.id }));
    if (!parent) return res.status(404).json({ error: 'Note not found' });
    const children = await Note.find(owned(req, { parentId: req.params.id })).sort({ order: 1, updatedAt: -1 });
    res.json(children);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Note.findOneAndUpdate(
      owned(req, { _id: req.params.id }),
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Note not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const note = await Note.findOne(owned(req, { _id: req.params.id }));
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (note.isNotebook) {
      await Note.deleteMany(owned(req, { notebookId: note._id }));
    }
    await Note.deleteMany(owned(req, { parentId: note._id }));
    await Note.findOneAndDelete(owned(req, { _id: req.params.id }));
    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
