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

/* ── PATCH /:id — partial update used by the goal workspace ────────────
   PUT replaces the whole goal (and defaults missing milestones to []),
   which is right for the edit dialog but would wipe sub-goals when the
   page only wants to add a follow-up. PATCH touches just what it is sent. */
const JSON_LISTS = ['milestones', 'followUps', 'checkIns', 'resources', 'obstacles'];
const STATUSES = ['not-started', 'in-progress', 'completed', 'abandoned'];

function metricProgress(g) {
  const { metricStart, metricTarget, metricCurrent } = g;
  if (metricTarget == null || metricCurrent == null) return null;
  const start = metricStart ?? 0;
  if (metricTarget === start) return metricCurrent >= metricTarget ? 100 : 0;
  const pct = ((metricCurrent - start) / (metricTarget - start)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

router.patch('/:id', async (req, res) => {
  try {
    const existing = await prisma.goal.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Goal not found' });

    const b = req.body || {};
    const data = {};
    for (const key of JSON_LISTS) {
      if (b[key] !== undefined) {
        if (!Array.isArray(b[key])) return res.status(400).json({ error: `${key} must be a list` });
        data[key] = JSON.parse(JSON.stringify(b[key])).slice(0, 300);
      }
    }
    for (const key of ['title', 'description', 'why', 'category', 'icon', 'metricLabel', 'metricUnit']) {
      if (b[key] !== undefined) data[key] = String(b[key] ?? '').slice(0, key === 'description' || key === 'why' ? 5000 : 200);
    }
    if (data.title !== undefined && !data.title.trim()) return res.status(400).json({ error: 'Title is required' });
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
      data.status = b.status;
    }
    if (b.horizon !== undefined && ['sprint', 'season', 'year', 'lifetime'].includes(b.horizon)) data.horizon = b.horizon;
    if (b.targetDate !== undefined) {
      const d = b.targetDate ? new Date(b.targetDate) : null;
      data.targetDate = d && !Number.isNaN(d.getTime()) ? d : null;
    }
    for (const key of ['metricStart', 'metricTarget', 'metricCurrent']) {
      if (b[key] !== undefined) {
        const n = b[key] === '' || b[key] == null ? null : Number(b[key]);
        data[key] = Number.isFinite(n) ? n : null;
      }
    }

    const merged = { ...existing, ...data };
    const milestones = Array.isArray(merged.milestones) ? merged.milestones : [];
    const { total, progress: msProgress } = flattenMilestoneProgress(milestones);
    const mProgress = metricProgress(merged);
    let progress = total > 0 ? msProgress : (mProgress ?? existing.progress);
    if (total > 0 && mProgress != null) progress = Math.round((msProgress + mProgress) / 2);
    if (data.status === 'completed') progress = Math.max(progress, 100);

    let status = data.status || existing.status;
    if (!data.status) {
      if (progress >= 100 && status !== 'abandoned') status = 'completed';
      else if (progress > 0 && status === 'not-started') status = 'in-progress';
      else if (progress < 100 && status === 'completed') status = 'in-progress';
    }

    const updated = await prisma.goal.update({
      where: { id: existing.id },
      data: {
        ...data,
        progress,
        status,
        achievements: unlockAchievements({ ...merged, status }, milestones, progress),
        momentum: bumpMomentum(existing.momentum),
      },
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
