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

const KINDS = ['focus', 'short-break', 'long-break'];
const LINK_TYPES = ['goal', 'habit', 'project', 'note', 'inbox', 'book'];
const MAX_MINUTES = 240;

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

    res.json(
      serialize({
        sessions: sessions.slice(0, 60),
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
        daily: [...byDay.entries()].map(([date, minutes]) => ({ date, minutes })),
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

    const minutes = parseInt(body.minutes, 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > MAX_MINUTES) {
      throw badRequest(`Minutes must be between 1 and ${MAX_MINUTES}`);
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
