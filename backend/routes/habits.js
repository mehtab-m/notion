const express = require('express');
const router = express.Router();
const Habit = require('../models/Habit');
const { owned } = require('../utils/scope');

router.get('/', async (req, res) => {
  try {
    const habits = await Habit.find(owned(req)).sort({ createdAt: -1 });
    res.json(habits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const saved = await new Habit({ ...req.body, userId: req.user._id }).save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Habit.findOneAndUpdate(
      owned(req, { _id: req.params.id }),
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Habit not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/toggle', async (req, res) => {
  try {
    const { date } = req.body;
    const habit = await Habit.findOne(owned(req, { _id: req.params.id }));
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    const idx = habit.completedDates.indexOf(date);
    if (idx >= 0) habit.completedDates.splice(idx, 1);
    else habit.completedDates.push(date);
    const sorted = [...habit.completedDates].sort((a, b) => (a > b ? -1 : 1));
    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    for (const d of sorted) {
      const dt = new Date(d);
      dt.setHours(0, 0, 0, 0);
      const diff = Math.round((cursor - dt) / 86400000);
      if (diff === 0 || diff === 1) { streak++; cursor = dt; }
      else break;
    }
    habit.streak = streak;
    await habit.save();
    res.json(habit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Habit.findOneAndDelete(owned(req, { _id: req.params.id }));
    if (!deleted) return res.status(404).json({ error: 'Habit not found' });
    res.json({ message: 'Habit deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
