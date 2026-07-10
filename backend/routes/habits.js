const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { cleanBody } = require('../utils/body');
const { serialize } = require('../utils/serialize');
const { seedDefaultHabits } = require('../utils/defaultHabits');

router.get('/', async (req, res) => {
  try {
    await seedDefaultHabits(prisma, req.user.id);
    const habits = await prisma.habit.findMany({
      where: owned(req),
      orderBy: { createdAt: 'desc' },
    });
    res.json(serialize(habits));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const saved = await prisma.habit.create({
      data: { ...cleanBody(req.body), userId: req.user.id },
    });
    res.status(201).json(serialize(saved));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.habit.findFirst({
      where: owned(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Habit not found' });
    const updated = await prisma.habit.update({
      where: { id: existing.id },
      data: cleanBody(req.body),
    });
    res.json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/toggle', async (req, res) => {
  try {
    const { date } = req.body;
    const habit = await prisma.habit.findFirst({
      where: owned(req, { _id: req.params.id }),
    });
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    const completedDates = [...habit.completedDates];
    const idx = completedDates.indexOf(date);
    if (idx >= 0) completedDates.splice(idx, 1);
    else completedDates.push(date);
    const sorted = [...completedDates].sort((a, b) => (a > b ? -1 : 1));
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
      } else break;
    }
    const updated = await prisma.habit.update({
      where: { id: habit.id },
      data: { completedDates, streak },
    });
    res.json(serialize(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.habit.findFirst({
      where: owned(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Habit not found' });
    await prisma.habit.delete({ where: { id: existing.id } });
    res.json({ message: 'Habit deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
