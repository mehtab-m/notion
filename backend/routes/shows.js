const express = require('express');
const router = express.Router();
const Show = require('../models/Show');
const upload = require('../middleware/upload');

// GET all shows
router.get('/', async (req, res) => {
  try {
    const shows = await Show.find().sort({ createdAt: -1 });
    res.json(shows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create show
router.post('/', upload.single('posterImage'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.posterImage = '/uploads/' + req.file.filename;
    }
    const show = new Show(data);
    const saved = await show.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET single show
router.get('/:id', async (req, res) => {
  try {
    const show = await Show.findById(req.params.id);
    if (!show) return res.status(404).json({ error: 'Show not found' });
    res.json(show);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update show
router.put('/:id', upload.single('posterImage'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.posterImage = '/uploads/' + req.file.filename;
    }
    const updated = await Show.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ error: 'Show not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE show
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Show.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Show not found' });
    res.json({ message: 'Show deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
