/* ─── Insights ─────────────────────────────────────────────
   Everything the Analytics page and the Today view read. All
   of it is derived from existing rows — nothing here is
   stored, so the numbers can never drift from the source.  */

const express = require('express');
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { active, notTrashed } = require('../utils/lifecycle');
const { serialize } = require('../utils/serialize');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDays);
  return d;
}

/** An ordered list of the last N day keys, oldest first. */
function lastNDays(n) {
  return Array.from({ length: n }, (_, i) => dayKey(startOfDay(n - 1 - i)));
}

// GET /api/analytics/overview?days=90
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 90, 7), 365);
    const window = lastNDays(days);
    const windowSet = new Set(window);
    const since = startOfDay(days - 1);

    const [habits, goals, books, shows, notes, sessions, transactions, inbox] =
      await Promise.all([
        prisma.habit.findMany({
          where: active(req),
          select: { id: true, name: true, icon: true, color: true, streak: true, completedDates: true, createdAt: true },
        }),
        prisma.goal.findMany({
          where: active(req),
          select: {
            id: true, title: true, icon: true, category: true, status: true,
            progress: true, momentum: true, horizon: true, targetDate: true,
            createdAt: true, updatedAt: true,
          },
        }),
        prisma.book.findMany({
          where: active(req),
          select: { id: true, title: true, status: true, currentPage: true, totalPages: true, finishedAt: true, createdAt: true },
        }),
        prisma.show.findMany({
          where: active(req),
          select: { id: true, status: true, mediaType: true, createdAt: true },
        }),
        prisma.note.findMany({
          where: active(req),
          select: { id: true, createdAt: true, updatedAt: true, tags: true },
        }),
        prisma.focusSession.findMany({
          where: owned(req, { startedAt: { gte: since }, kind: 'focus' }),
          select: { seconds: true, completed: true, startedAt: true },
        }),
        prisma.moneyTransaction.findMany({
          where: owned(req, { createdAt: { gte: since } }),
          select: { type: true, amount: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.inboxItem.findMany({
          where: owned(req),
          select: { status: true, createdAt: true, completedAt: true },
        }),
      ]);

    /* ── Habit heatmap ───────────────────────────────────
       One row per habit plus a combined per-day intensity
       the calendar grid renders directly. */
    const heatmap = window.map((date) => {
      const done = habits.filter((h) => (h.completedDates || []).includes(date)).length;
      return {
        date,
        done,
        total: habits.length,
        ratio: habits.length ? Math.round((done / habits.length) * 100) : 0,
      };
    });

    const habitBreakdown = habits
      .map((h) => {
        const inWindow = (h.completedDates || []).filter((d) => windowSet.has(d));
        return {
          _id: h.id,
          name: h.name,
          icon: h.icon,
          color: h.color,
          streak: h.streak,
          completions: inWindow.length,
          consistency: Math.round((inWindow.length / days) * 100),
        };
      })
      .sort((a, b) => b.completions - a.completions);

    /* ── Goal velocity ───────────────────────────────────
       Progress per goal against the share of its runway
       already spent — "ahead" vs "behind" at a glance. */
    const now = Date.now();
    const goalVelocity = goals
      .filter((g) => g.status !== 'abandoned')
      .map((g) => {
        const started = new Date(g.createdAt).getTime();
        const target = g.targetDate ? new Date(g.targetDate).getTime() : null;
        let expected = null;
        if (target && target > started) {
          expected = Math.max(0, Math.min(100, Math.round(((now - started) / (target - started)) * 100)));
        }
        return {
          _id: g.id,
          title: g.title,
          icon: g.icon,
          category: g.category,
          status: g.status,
          progress: g.progress,
          momentum: g.momentum,
          horizon: g.horizon,
          targetDate: g.targetDate,
          expected,
          delta: expected == null ? null : g.progress - expected,
        };
      })
      .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));

    /* ── Money trend ─────────────────────────────────────
       Running balance across the window, plus per-day flow. */
    const moneyByDay = new Map(window.map((d) => [d, { date: d, gave: 0, received: 0 }]));
    for (const t of transactions) {
      const key = dayKey(t.createdAt);
      const bucket = moneyByDay.get(key);
      if (!bucket) continue;
      if (t.type === 'gave') bucket.gave += t.amount;
      else bucket.received += t.amount;
    }
    let running = 0;
    const moneyTrend = [...moneyByDay.values()].map((b) => {
      running += b.gave - b.received;
      return { ...b, net: b.gave - b.received, balance: Math.round(running * 100) / 100 };
    });

    /* ── Focus per day ───────────────────────────────────── */
    const focusByDay = new Map(window.map((d) => [d, 0]));
    for (const s of sessions) {
      const key = dayKey(s.startedAt);
      if (focusByDay.has(key)) {
        focusByDay.set(key, focusByDay.get(key) + Math.round((s.seconds || 0) / 60));
      }
    }

    /* ── Reading ─────────────────────────────────────────── */
    const pagesRead = books.reduce((sum, b) => sum + (b.currentPage || 0), 0);
    const booksFinished = books.filter(
      (b) => b.status === 'completed' && b.finishedAt && new Date(b.finishedAt) >= since
    ).length;

    /* ── Streak leaderboard ──────────────────────────────── */
    const leaderboard = [...habitBreakdown]
      .sort((a, b) => b.streak - a.streak || b.completions - a.completions)
      .slice(0, 10);

    const totalCompletions = habitBreakdown.reduce((s, h) => s + h.completions, 0);
    const focusMinutes = [...focusByDay.values()].reduce((a, b) => a + b, 0);

    res.json(
      serialize({
        range: { days, from: window[0], to: window[window.length - 1] },
        summary: {
          habits: habits.length,
          habitCompletions: totalCompletions,
          habitConsistency: habits.length
            ? Math.round((totalCompletions / (habits.length * days)) * 100)
            : 0,
          longestStreak: habits.reduce((max, h) => Math.max(max, h.streak || 0), 0),
          goals: goals.length,
          goalsCompleted: goals.filter((g) => g.status === 'completed').length,
          avgGoalProgress: goals.length
            ? Math.round(goals.reduce((s, g) => s + (g.progress || 0), 0) / goals.length)
            : 0,
          books: books.length,
          booksFinished,
          pagesRead,
          shows: shows.length,
          showsWatching: shows.filter((s) => s.status === 'watching').length,
          notes: notes.length,
          focusMinutes,
          focusSessions: sessions.length,
          inboxOpen: inbox.filter((i) => i.status === 'open').length,
          inboxDone: inbox.filter((i) => i.status === 'done').length,
        },
        heatmap,
        habitBreakdown,
        goalVelocity,
        moneyTrend,
        focusDaily: [...focusByDay.entries()].map(([date, minutes]) => ({ date, minutes })),
        leaderboard,
      })
    );
  })
);

// GET /api/analytics/today — everything due, in progress, or worth doing now
router.get(
  '/today',
  asyncHandler(async (req, res) => {
    const today = dayKey(new Date());
    const dayStart = startOfDay(0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const weekAhead = new Date(dayStart);
    weekAhead.setDate(weekAhead.getDate() + 7);

    const [habits, goals, inbox, sessions, books, overdue] = await Promise.all([
      prisma.habit.findMany({
        where: active(req),
        select: { id: true, name: true, icon: true, color: true, streak: true, completedDates: true, frequency: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.goal.findMany({
        where: active(req, { status: { not: 'completed' } }),
        select: { id: true, title: true, icon: true, progress: true, status: true, targetDate: true, milestones: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      prisma.inboxItem.findMany({
        where: owned(req, { status: 'open' }),
        orderBy: [{ pinned: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 50,
      }),
      prisma.focusSession.findMany({
        where: owned(req, { startedAt: { gte: dayStart, lt: dayEnd }, kind: 'focus' }),
        select: { seconds: true, completed: true, label: true, startedAt: true },
      }),
      prisma.book.findMany({
        where: active(req, { status: 'reading' }),
        select: { id: true, title: true, author: true, currentPage: true, totalPages: true, coverImage: true },
        take: 5,
      }),
      prisma.goal.findMany({
        where: active(req, {
          status: { not: 'completed' },
          targetDate: { lt: dayStart, not: null },
        }),
        select: { id: true, title: true, icon: true, progress: true, targetDate: true },
        take: 10,
      }),
    ]);

    const habitsToday = habits.map((h) => ({
      _id: h.id,
      name: h.name,
      icon: h.icon,
      color: h.color,
      streak: h.streak,
      done: (h.completedDates || []).includes(today),
    }));

    /* Milestones with a due date inside the next week — the concrete
       next actions, not the goals they hang off. */
    const upcomingMilestones = [];
    for (const g of goals) {
      const milestones = Array.isArray(g.milestones) ? g.milestones : [];
      for (const m of milestones) {
        if (m.done || !m.dueDate) continue;
        const due = new Date(m.dueDate);
        if (Number.isNaN(due.getTime()) || due >= weekAhead) continue;
        upcomingMilestones.push({
          _id: m.id,
          goalId: g.id,
          goalTitle: g.title,
          goalIcon: g.icon,
          text: m.text,
          dueDate: m.dueDate,
          overdue: due < dayStart,
        });
      }
    }
    upcomingMilestones.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const focusMinutes = Math.round(sessions.reduce((s, x) => s + (x.seconds || 0), 0) / 60);
    const habitsDone = habitsToday.filter((h) => h.done).length;
    const dueToday = inbox.filter(
      (i) => i.dueDate && new Date(i.dueDate) >= dayStart && new Date(i.dueDate) < dayEnd
    );

    res.json(
      serialize({
        date: today,
        habits: habitsToday,
        goals: goals.slice(0, 6),
        overdueGoals: overdue,
        milestones: upcomingMilestones.slice(0, 12),
        inbox: inbox.slice(0, 20),
        dueToday,
        reading: books,
        focus: { sessions: sessions.length, minutes: focusMinutes },
        progress: {
          habitsDone,
          habitsTotal: habitsToday.length,
          percent: habitsToday.length ? Math.round((habitsDone / habitsToday.length) * 100) : 0,
        },
      })
    );
  })
);

// GET /api/analytics/weekly — the summary card, one week at a glance
router.get(
  '/weekly',
  asyncHandler(async (req, res) => {
    const week = lastNDays(7);
    const weekSet = new Set(week);
    const since = startOfDay(6);
    const prevSince = startOfDay(13);

    const [habits, goals, sessions, notes, inbox, booksFinished] = await Promise.all([
      prisma.habit.findMany({
        where: active(req),
        select: { id: true, name: true, icon: true, streak: true, completedDates: true },
      }),
      prisma.goal.findMany({
        where: active(req),
        select: { id: true, title: true, icon: true, progress: true, status: true, updatedAt: true },
      }),
      prisma.focusSession.findMany({
        where: owned(req, { startedAt: { gte: prevSince }, kind: 'focus' }),
        select: { seconds: true, startedAt: true, completed: true },
      }),
      prisma.note.count({ where: notTrashed(req, { createdAt: { gte: since } }) }),
      prisma.inboxItem.count({ where: owned(req, { completedAt: { gte: since } }) }),
      prisma.book.count({
        where: active(req, { status: 'completed', finishedAt: { gte: since } }),
      }),
    ]);

    const completionsThisWeek = habits.reduce(
      (sum, h) => sum + (h.completedDates || []).filter((d) => weekSet.has(d)).length,
      0
    );
    const possible = habits.length * 7;

    const thisWeekMinutes = Math.round(
      sessions
        .filter((s) => new Date(s.startedAt) >= since)
        .reduce((sum, s) => sum + (s.seconds || 0), 0) / 60
    );
    const lastWeekMinutes = Math.round(
      sessions
        .filter((s) => new Date(s.startedAt) < since)
        .reduce((sum, s) => sum + (s.seconds || 0), 0) / 60
    );

    const topHabit = habits
      .map((h) => ({
        name: h.name,
        icon: h.icon,
        count: (h.completedDates || []).filter((d) => weekSet.has(d)).length,
      }))
      .sort((a, b) => b.count - a.count)[0] || null;

    res.json(
      serialize({
        range: { from: week[0], to: week[6] },
        habitCompletions: completionsThisWeek,
        habitPossible: possible,
        habitRate: possible ? Math.round((completionsThisWeek / possible) * 100) : 0,
        topHabit,
        longestStreak: habits.reduce((max, h) => Math.max(max, h.streak || 0), 0),
        goalsTouched: goals.filter((g) => new Date(g.updatedAt) >= since).length,
        goalsCompleted: goals.filter(
          (g) => g.status === 'completed' && new Date(g.updatedAt) >= since
        ).length,
        focusMinutes: thisWeekMinutes,
        focusDelta: thisWeekMinutes - lastWeekMinutes,
        notesCreated: notes,
        inboxCleared: inbox,
        booksFinished,
        daily: week.map((date) => ({
          date,
          habits: habits.filter((h) => (h.completedDates || []).includes(date)).length,
          focus: Math.round(
            sessions
              .filter((s) => dayKey(s.startedAt) === date)
              .reduce((sum, s) => sum + (s.seconds || 0), 0) / 60
          ),
        })),
      })
    );
  })
);

module.exports = router;
