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
    weekLogins,
    weekAppUses,
    totalActivity,
    totalLogins,
    totalAppUses,
    booksCount,
    showsCount,
    habitsCount,
    goalsCount,
    projectsCount,
    notesCount,
    tablesCount,
    stickyNotesCount,
  ] = await Promise.all([
    prisma.userActivity.count({ where: { userId: user.id, createdAt: { gte: weekAgo } } }),
    prisma.userActivity.count({ where: { userId: user.id, type: 'login', createdAt: { gte: weekAgo } } }),
    prisma.userActivity.count({ where: { userId: user.id, type: 'app_use', createdAt: { gte: weekAgo } } }),
    prisma.userActivity.count({ where: { userId: user.id } }),
    prisma.userActivity.count({ where: { userId: user.id, type: 'login' } }),
    prisma.userActivity.count({ where: { userId: user.id, type: 'app_use' } }),
    prisma.book.count({ where: { userId: user.id } }),
    prisma.show.count({ where: { userId: user.id } }),
    prisma.habit.count({ where: { userId: user.id } }),
    prisma.goal.count({ where: { userId: user.id } }),
    prisma.project.count({ where: { userId: user.id } }),
    prisma.note.count({ where: { userId: user.id } }),
    prisma.spreadsheet.count({ where: { userId: user.id } }),
    prisma.stickyNote.count({ where: { userId: user.id } }),
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
    weekLogins,
    weekAppUses,
    totalActivityCount: totalActivity,
    totalLogins,
    totalAppUses,
    // Privacy-safe profile + usage snapshot (no passwords / codes)
    profile: {
      name: user.name,
      email: user.email,
      role: isAdminUser(user) ? 'admin' : user.role,
      isDeveloper: user.isDeveloper,
      isVerified: user.isVerified,
      joinedAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      graceEndsAt: user.activeGraceUntil,
    },
    content: {
      books: booksCount,
      shows: showsCount,
      habits: habitsCount,
      goals: goalsCount,
      projects: projectsCount,
      notes: notesCount,
      tables: tablesCount,
      stickyNotes: stickyNotesCount,
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
      totalTables,
      totalStickyNotes,
      totalActivitiesWeek,
      weekLogins,
      weekAppUses,
      signupsByDay,
    ] = await Promise.all([
      prisma.book.count(),
      prisma.show.count(),
      prisma.habit.count(),
      prisma.goal.count(),
      prisma.project.count(),
      prisma.note.count(),
      prisma.spreadsheet.count(),
      prisma.stickyNote.count(),
      prisma.userActivity.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.userActivity.count({ where: { type: 'login', createdAt: { gte: weekAgo } } }),
      prisma.userActivity.count({ where: { type: 'app_use', createdAt: { gte: weekAgo } } }),
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
        weeklyLogins: weekLogins,
        weeklyAppUses: weekAppUses,
        activeThreshold: ACTIVE_WEEKLY_THRESHOLD,
        graceDays: GRACE_DAYS,
      },
      // Only privacy-safe operational metrics — no passwords, codes, or content bodies
      ethicalDataPolicy: {
        collected: ['login events', 'throttled app_use pings', 'account profile fields', 'content counts'],
        notCollected: ['passwords', 'verification codes', 'note/page content bodies', 'third-party tracking'],
        activeRule: `Active if ≥${ACTIVE_WEEKLY_THRESHOLD} login/app_use events in 7 days, or within first ${GRACE_DAYS} days of signup`,
      },
      contentTotals: {
        books: totalBooks,
        shows: totalShows,
        habits: totalHabits,
        goals: totalGoals,
        projects: totalProjects,
        notes: totalNotes,
        tables: totalTables,
        stickyNotes: totalStickyNotes,
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
