const express = require('express');
const router = express.Router();
const Habit = require('../models/Habit');

router.get('/', async (req, res) => {
  try {
    const habits = await Habit.find().sort({ createdAt: -1 });
    res.json(habits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const habit = new Habit(req.body);
    const saved = await habit.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Habit.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Habit not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Toggle a date on/off for a habit
router.post('/:id/toggle', async (req, res) => {
  try {
    const { date } = req.body; // "YYYY-MM-DD"
    const habit = await Habit.findById(req.params.id);
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    const idx = habit.completedDates.indexOf(date);
    if (idx >= 0) {
      habit.completedDates.splice(idx, 1);
    } else {
      habit.completedDates.push(date);
    }
    // Recalculate streak (consecutive days ending today or yesterday)
    const sorted = [...habit.completedDates].sort((a, b) => (a > b ? -1 : 1));
    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    for (const d of sorted) {
      const dt = new Date(d);
      dt.setHours(0, 0, 0, 0);
      const diff = Math.round((cursor - dt) / 86400000);
      if (diff === 0 || diff === 1) {
        streak++;
        cursor = dt;
      } else {
        break;
      }
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
    const deleted = await Habit.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Habit not found' });
    res.json({ message: 'Habit deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
