const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { active } = require('../utils/lifecycle');
const { accessibleProjectsWhere } = require('../utils/projectAccess');
const { serialize } = require('../utils/serialize');
const { asyncHandler } = require('../middleware/errors');

/* Only the columns the dashboard actually renders. Selecting the whole
   row pulled note bodies, descriptions and cover blobs across the wire
   on every page load. */
const BOOK_FIELDS = {
  id: true, title: true, author: true, status: true,
  currentPage: true, totalPages: true, coverImage: true,
};
const GOAL_FIELDS = { id: true, title: true, category: true, status: true, progress: true };
const HABIT_FIELDS = { id: true, name: true, streak: true, completedDates: true, color: true };
const PROJECT_FIELDS = { id: true, title: true, progress: true, priority: true, status: true };

/** Turn a Prisma groupBy result into a { value: count } lookup. */
function tally(rows, key, keys) {
  const out = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const row of rows) {
    if (row[key] in out) out[row[key]] = row._count._all;
  }
  return out;
}

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const filter = active(req);
    const isDeveloper = req.user?.isDeveloper === true;
    const projectFilter = accessibleProjectsWhere(req.user);

    const [books, goals, habits, projects, booksGrouped, goalsGrouped, totals] =
      await Promise.all([
        prisma.book.findMany({ where: filter, select: BOOK_FIELDS }),
        prisma.goal.findMany({ where: filter, select: GOAL_FIELDS }),
        prisma.habit.findMany({ where: filter, select: HABIT_FIELDS }),
        isDeveloper
          ? prisma.project.findMany({
              // The UI only charts active projects — filter in the DB.
              where: { AND: [projectFilter, { status: 'active' }] },
              select: PROJECT_FIELDS,
            })
          : Promise.resolve([]),
        // Counting in the database beats counting in JS over full rows.
        prisma.book.groupBy({ by: ['status'], where: filter, _count: { _all: true } }),
        prisma.goal.groupBy({ by: ['status'], where: filter, _count: { _all: true } }),
        isDeveloper
          ? prisma.project.count({ where: projectFilter })
          : Promise.resolve(0),
      ]);

    const bookProgress = books.map((b) => ({
      _id: b.id,
      title: b.title,
      author: b.author,
      status: b.status,
      currentPage: b.currentPage,
      totalPages: b.totalPages,
      progress: b.totalPages > 0 ? Math.round((b.currentPage / b.totalPages) * 100) : 0,
      coverImage: b.coverImage,
    }));

    const goalProgress = goals.map((g) => ({
      _id: g.id,
      title: g.title,
      category: g.category,
      status: g.status,
      progress: g.progress,
    }));

    const habitStats = habits.map((h) => ({
      _id: h.id,
      name: h.name,
      streak: h.streak,
      completedCount: (h.completedDates || []).length,
      color: h.color,
    }));

    const projectProgress = projects.map((p) => ({
      _id: p.id,
      title: p.title,
      progress: p.progress,
      priority: p.priority,
    }));

    res.json(
      serialize({
        bookProgress,
        goalProgress,
        habitStats,
        projectProgress,
        booksByStatus: tally(booksGrouped, 'status', [
          'reading', 'completed', 'want-to-read', 'paused',
        ]),
        goalsByStatus: tally(goalsGrouped, 'status', [
          'in-progress', 'completed', 'not-started', 'abandoned',
        ]),
        totals: {
          books: books.length,
          goals: goals.length,
          habits: habits.length,
          projects: totals,
        },
      })
    );
  })
);

module.exports = router;
