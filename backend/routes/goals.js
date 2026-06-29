const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Goal = require('../models/Goal');
const { owned } = require('../utils/scope');

router.get('/', async (req, res) => {
  try {
    const goals = await Goal.find(owned(req)).sort({ updatedAt: -1 });
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const saved = await new Goal({ ...req.body, userId: req.user._id }).save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Goal.findOneAndUpdate(
      owned(req, { _id: req.params.id }),
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Goal not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Goal.findOneAndDelete(owned(req, { _id: req.params.id }));
    if (!deleted) return res.status(404).json({ error: 'Goal not found' });
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/milestones/:msId/toggle', async (req, res) => {
  try {
    const goal = await Goal.findOne(owned(req, { _id: req.params.id }));
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    const ms = goal.milestones.find((m) => m.id === req.params.msId);
    if (!ms) return res.status(404).json({ error: 'Milestone not found' });
    ms.done = !ms.done;
    const total = goal.milestones.length;
    const done = goal.milestones.filter((m) => m.done).length;
    goal.progress = total > 0 ? Math.round((done / total) * 100) : 0;
    goal.updatedAt = Date.now();
    goal.markModified('milestones');
    await goal.save();
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
