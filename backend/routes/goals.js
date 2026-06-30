const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { cleanBody } = require('../utils/body');
const { serialize } = require('../utils/serialize');

router.get('/', async (req, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: owned(req),
      orderBy: { updatedAt: 'desc' },
    });
    res.json(serialize(goals));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = cleanBody(req.body);
    const saved = await prisma.goal.create({
      data: {
        ...body,
        milestones: body.milestones || [],
        userId: req.user.id,
      },
    });
    res.status(201).json(serialize(saved));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.goal.findFirst({
      where: owned(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Goal not found' });
    const updated = await prisma.goal.update({
      where: { id: existing.id },
      data: cleanBody(req.body),
    });
    res.json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.goal.findFirst({
      where: owned(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Goal not found' });
    await prisma.goal.delete({ where: { id: existing.id } });
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/milestones/:msId/toggle', async (req, res) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: owned(req, { _id: req.params.id }),
    });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    const milestones = Array.isArray(goal.milestones) ? [...goal.milestones] : [];
    const ms = milestones.find((m) => m.id === req.params.msId);
    if (!ms) return res.status(404).json({ error: 'Milestone not found' });
    ms.done = !ms.done;
    const total = milestones.length;
    const done = milestones.filter((m) => m.done).length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    const updated = await prisma.goal.update({
      where: { id: goal.id },
      data: { milestones, progress },
    });
    res.json(serialize(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
