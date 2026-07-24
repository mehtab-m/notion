const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { adminMiddleware } = require('../middleware/auth');
const {
  ACTIVE_WEEKLY_THRESHOLD,
  GRACE_DAYS,
  recomputeActiveStatus,
  isAdminUser,
} = require('../utils/activity');
const { serialize } = require('../utils/serialize');

router.use(adminMiddleware);

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function buildUserAnalytics(user) {
  const weekAgo = daysAgo(7);
  const [
    weekActivity,
    totalActivity,
    booksCount,
    showsCount,
    habitsCount,
    goalsCount,
    projectsCount,
    notesCount,
  ] = await Promise.all([
    prisma.userActivity.count({ where: { userId: user.id, createdAt: { gte: weekAgo } } }),
    prisma.userActivity.count({ where: { userId: user.id } }),
    prisma.book.count({ where: { userId: user.id } }),
    prisma.show.count({ where: { userId: user.id } }),
    prisma.habit.count({ where: { userId: user.id } }),
    prisma.goal.count({ where: { userId: user.id } }),
    prisma.project.count({ where: { userId: user.id } }),
    prisma.note.count({ where: { userId: user.id } }),
  ]);

  const now = new Date();
  const inGrace = user.activeGraceUntil ? now <= new Date(user.activeGraceUntil) : false;

  return {
    _id: user.id,
    name: user.name,
    email: user.email,
    role: isAdminUser(user) ? 'admin' : user.role,
    isDeveloper: user.isDeveloper,
    isVerified: user.isVerified,
    isActive: user.isActive,
    activeReason: inGrace
      ? 'grace_period'
      : weekActivity >= ACTIVE_WEEKLY_THRESHOLD
        ? 'weekly_activity'
        : 'inactive',
    activeGraceUntil: user.activeGraceUntil,
    lastActiveAt: user.lastActiveAt,
    createdAt: user.createdAt,
    weekActivityCount: weekActivity,
    totalActivityCount: totalActivity,
    content: {
      books: booksCount,
      shows: showsCount,
      habits: habitsCount,
      goals: goalsCount,
      projects: projectsCount,
      notes: notesCount,
    },
  };
}

// GET /api/admin/stats — product overview
router.get('/stats', async (req, res) => {
  try {
    const weekAgo = daysAgo(7);
    const monthAgo = daysAgo(30);

    const users = await prisma.user.findMany({
      where: { isVerified: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isDeveloper: true,
        isVerified: true,
        isActive: true,
        activeGraceUntil: true,
        lastActiveAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Refresh active flags for all users so dashboard is accurate
    await Promise.all(users.map((u) => recomputeActiveStatus(u.id)));

    const refreshed = await prisma.user.findMany({
      where: { isVerified: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isDeveloper: true,
        isVerified: true,
        isActive: true,
        activeGraceUntil: true,
        lastActiveAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const userRows = await Promise.all(refreshed.map(buildUserAnalytics));

    const totalUsers = refreshed.length;
    const activeUsers = refreshed.filter((u) => u.isActive).length;
    const inactiveUsers = totalUsers - activeUsers;
    const developers = refreshed.filter((u) => u.isDeveloper === true).length;
    const nonDevelopers = refreshed.filter((u) => u.isDeveloper === false).length;
    const undecided = refreshed.filter((u) => u.isDeveloper == null).length;
    const newThisWeek = refreshed.filter((u) => new Date(u.createdAt) >= weekAgo).length;
    const newThisMonth = refreshed.filter((u) => new Date(u.createdAt) >= monthAgo).length;
    const inGrace = refreshed.filter(
      (u) => u.activeGraceUntil && new Date() <= new Date(u.activeGraceUntil)
    ).length;

    const [
      totalBooks,
      totalShows,
      totalHabits,
      totalGoals,
      totalProjects,
      totalNotes,
      totalActivitiesWeek,
      signupsByDay,
    ] = await Promise.all([
      prisma.book.count(),
      prisma.show.count(),
      prisma.habit.count(),
      prisma.goal.count(),
      prisma.project.count(),
      prisma.note.count(),
      prisma.userActivity.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.$queryRaw`
        SELECT DATE("createdAt") as day, COUNT(*)::int as count
        FROM "User"
        WHERE "isVerified" = true AND "createdAt" >= ${monthAgo}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `.catch(() => []),
    ]);

    res.json({
      overview: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        developers,
        nonDevelopers,
        undecidedDeveloper: undecided,
        newThisWeek,
        newThisMonth,
        inGracePeriod: inGrace,
        weeklyActivityEvents: totalActivitiesWeek,
        activeThreshold: ACTIVE_WEEKLY_THRESHOLD,
        graceDays: GRACE_DAYS,
      },
      contentTotals: {
        books: totalBooks,
        shows: totalShows,
        habits: totalHabits,
        goals: totalGoals,
        projects: totalProjects,
        notes: totalNotes,
      },
      signupsByDay: Array.isArray(signupsByDay)
        ? signupsByDay.map((r) => ({
            day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
            count: r.count,
          }))
        : [],
      users: userRows,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users — list users with analytics
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isVerified: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isDeveloper: true,
        isVerified: true,
        isActive: true,
        activeGraceUntil: true,
        lastActiveAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const rows = await Promise.all(users.map(buildUserAnalytics));
    res.json(serialize(rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id — set role / active override
router.patch('/users/:id', async (req, res) => {
  try {
    const { role, isActive } = req.body;
    const data = {};
    if (role === 'admin' || role === 'user') data.role = role;
    if (typeof isActive === 'boolean') data.isActive = isActive;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Provide role and/or isActive' });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ user: await buildUserAnalytics(updated) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
