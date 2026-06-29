const express = require('express');
const router = express.Router();
const StickyNote = require('../models/StickyNote');
const { owned } = require('../utils/scope');

router.get('/', async (req, res) => {
  try {
    const notes = await StickyNote.find(owned(req)).sort({ pinned: -1, createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const note = new StickyNote({ ...req.body, userId: req.user._id });
    const saved = await note.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await StickyNote.findOneAndUpdate(
      owned(req, { _id: req.params.id }),
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Sticky note not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await StickyNote.findOneAndDelete(owned(req, { _id: req.params.id }));
    if (!deleted) return res.status(404).json({ error: 'Sticky note not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
