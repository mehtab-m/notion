/* ─── Focus sessions ───────────────────────────────────────
   The pomodoro timer runs entirely in the browser; this only
   records what actually happened so streaks and the analytics
   page have real numbers behind them.                       */

const express = require('express');
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { serialize } = require('../utils/serialize');
const { asyncHandler, badRequest, notFoundError } = require('../middleware/errors');

const router = express.Router();

const KINDS = ['focus', 'short-break', 'long-break', 'run'];
const LINK_TYPES = ['goal', 'habit', 'project', 'note', 'inbox', 'book'];
const MAX_MINUTES = 240;
/* A run is a stopwatch, not a pomodoro — allow long outings. */
const MAX_RUN_MINUTES = 600;

/** Local-midnight boundary N days back, so "today" means the user's day. */
function startOfDay(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDays);
  return d;
}

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Consecutive days ending today (or yesterday) with a completed session. */
function focusStreak(sessions) {
  const days = new Set(
    sessions.filter((s) => s.completed && s.kind === 'focus').map((s) => dayKey(s.startedAt))
  );
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  // A day that has not ended yet should not break yesterday's streak.
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// GET /api/focus — recent sessions plus the headline numbers
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const since = startOfDay(days - 1);

    const sessions = await prisma.focusSession.findMany({
      where: owned(req, { startedAt: { gte: since } }),
      orderBy: { startedAt: 'desc' },
      take: 500,
    });

    const focusOnly = sessions.filter((s) => s.kind === 'focus');
    const todayKey = dayKey(new Date());
    const todaySessions = focusOnly.filter((s) => dayKey(s.startedAt) === todayKey);

    // Minutes per day, oldest first — the chart reads it straight through.
    const byDay = new Map();
    for (let i = days - 1; i >= 0; i -= 1) byDay.set(dayKey(startOfDay(i)), 0);
    for (const s of focusOnly) {
      const key = dayKey(s.startedAt);
      if (byDay.has(key)) byDay.set(key, byDay.get(key) + Math.round((s.seconds || 0) / 60));
    }

    const runs = sessions.filter((s) => s.kind === 'run');
    const runByDay = new Map([...byDay.keys()].map((k) => [k, 0]));
    for (const r of runs) {
      const key = dayKey(r.startedAt);
      if (runByDay.has(key)) runByDay.set(key, runByDay.get(key) + Math.round((r.seconds || 0) / 60));
    }
    const runDays = new Set(runs.map((r) => dayKey(r.startedAt)));
    let runStreak = 0;
    const cur = new Date();
    cur.setHours(0, 0, 0, 0);
    if (!runDays.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
    while (runDays.has(dayKey(cur))) { runStreak += 1; cur.setDate(cur.getDate() - 1); }

    res.json(
      serialize({
        sessions: sessions.slice(0, 60),
        runStats: {
          totalRuns: runs.length,
          totalMinutes: Math.round(runs.reduce((s, r) => s + (r.seconds || 0), 0) / 60),
          totalDistance: Math.round(runs.reduce((s, r) => s + (r.distance || 0), 0) * 100) / 100,
          longestMinutes: Math.round(Math.max(0, ...runs.map((r) => r.seconds || 0)) / 60),
          todayMinutes: Math.round(
            runs.filter((r) => dayKey(r.startedAt) === todayKey).reduce((s, r) => s + (r.seconds || 0), 0) / 60
          ),
          streak: runStreak,
        },
        stats: {
          totalSessions: focusOnly.length,
          completedSessions: focusOnly.filter((s) => s.completed).length,
          totalMinutes: Math.round(focusOnly.reduce((sum, s) => sum + (s.seconds || 0), 0) / 60),
          todaySessions: todaySessions.length,
          todayMinutes: Math.round(
            todaySessions.reduce((sum, s) => sum + (s.seconds || 0), 0) / 60
          ),
          streak: focusStreak(sessions),
        },
        daily: [...byDay.entries()].map(([date, minutes]) => ({ date, minutes, run: runByDay.get(date) || 0 })),
      })
    );
  })
);

// POST /api/focus — log a finished (or abandoned) session
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    const kind = body.kind || 'focus';
    if (!KINDS.includes(kind)) throw badRequest('Invalid session kind');

    const cap = kind === 'run' ? MAX_RUN_MINUTES : MAX_MINUTES;
    const minutes = parseInt(body.minutes, 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > cap) {
      throw badRequest(`Minutes must be between 1 and ${cap}`);
    }

    let distance = null;
    if (kind === 'run' && body.distance !== undefined && body.distance !== null && body.distance !== '') {
      distance = Number(body.distance);
      if (!Number.isFinite(distance) || distance < 0 || distance > 500) throw badRequest('Invalid distance');
      distance = Math.round(distance * 100) / 100;
    }

    const seconds = Math.max(0, Math.min(parseInt(body.seconds, 10) || 0, minutes * 60));

    let linkType = null;
    if (body.linkType) {
      if (!LINK_TYPES.includes(body.linkType)) throw badRequest('Invalid link type');
      linkType = body.linkType;
    }

    const saved = await prisma.focusSession.create({
      data: {
        kind,
        minutes,
        seconds,
        completed: body.completed === true || body.completed === 'true',
        label: String(body.label || '').slice(0, 200),
        linkType,
        linkId: linkType ? String(body.linkId || '') || null : null,
        distance,
        endedAt: new Date(),
        userId: req.user.id,
      },
    });
    res.status(201).json(serialize(saved));
  })
);

// DELETE /api/focus/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.focusSession.findFirst({
      where: owned(req, { _id: req.params.id }),
      select: { id: true },
    });
    if (!existing) throw notFoundError('Session not found');
    await prisma.focusSession.delete({ where: { id: existing.id } });
    res.json({ message: 'Session deleted', _id: existing.id });
  })
);

module.exports = router;
