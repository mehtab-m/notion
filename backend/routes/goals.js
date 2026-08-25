const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { active, notTrashed } = require('../utils/lifecycle');
const {
  prepareGoalData,
  flattenMilestoneProgress,
  unlockAchievements,
} = require('../utils/body');
const { serialize } = require('../utils/serialize');

function bumpMomentum(current = 0) {
  return Math.min(100, (current || 0) + 8);
}

async function saveGoalState(goal, milestones, extra = {}) {
  const { progress } = flattenMilestoneProgress(milestones);
  const achievements = unlockAchievements({ ...goal, ...extra }, milestones, progress);
  let status = extra.status || goal.status;
  if (progress >= 100 && status !== 'abandoned') status = 'completed';
  else if (progress > 0 && status === 'not-started') status = 'in-progress';

  return prisma.goal.update({
    where: { id: goal.id },
    data: {
      milestones,
      progress,
      achievements,
      status,
      momentum: bumpMomentum(goal.momentum),
      ...extra,
    },
  });
}

router.get('/', async (req, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: active(req),
      orderBy: { updatedAt: 'desc' },
    });
    res.json(serialize(goals));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = prepareGoalData(req.body);
    const milestones = Array.isArray(data.milestones) ? data.milestones : [];
    const { progress } = flattenMilestoneProgress(milestones);
    data.progress = progress;
    data.achievements = unlockAchievements({ achievements: [], status: data.status }, milestones, progress);
    data.momentum = 10;
    const saved = await prisma.goal.create({
      data: { ...data, userId: req.user.id },
    });
    res.status(201).json(serialize(saved));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.goal.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Goal not found' });
    const data = prepareGoalData(req.body);
    if (Array.isArray(data.milestones)) {
      const { progress } = flattenMilestoneProgress(data.milestones);
      data.progress = progress;
      data.achievements = unlockAchievements(
        { ...existing, status: data.status || existing.status },
        data.milestones,
        progress
      );
    }
    const updated = await prisma.goal.update({
      where: { id: existing.id },
      data,
    });
    res.json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.goal.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Goal not found' });
    await prisma.goal.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), archivedAt: null },
    });
    res.json({ message: 'Goal moved to trash', _id: existing.id, type: 'goal' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/milestones/:msId/toggle', async (req, res) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    const milestones = Array.isArray(goal.milestones)
      ? JSON.parse(JSON.stringify(goal.milestones))
      : [];
    const ms = milestones.find((m) => m.id === req.params.msId);
    if (!ms) return res.status(404).json({ error: 'Milestone not found' });
    ms.done = !ms.done;
    if (ms.done && Array.isArray(ms.children)) {
      ms.children = ms.children.map((c) => ({ ...c, done: true }));
    }
    const updated = await saveGoalState(goal, milestones);
    res.json(serialize(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/milestones/:msId/subgoals/:sgId/toggle', async (req, res) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    const milestones = Array.isArray(goal.milestones)
      ? JSON.parse(JSON.stringify(goal.milestones))
      : [];
    const ms = milestones.find((m) => m.id === req.params.msId);
    if (!ms) return res.status(404).json({ error: 'Milestone not found' });
    const children = Array.isArray(ms.children) ? ms.children : [];
    const sg = children.find((c) => c.id === req.params.sgId);
    if (!sg) return res.status(404).json({ error: 'Subgoal not found' });
    sg.done = !sg.done;
    if (children.length && children.every((c) => c.done)) ms.done = true;
    else if (!sg.done) ms.done = false;
    ms.children = children;
    const updated = await saveGoalState(goal, milestones);
    res.json(serialize(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
