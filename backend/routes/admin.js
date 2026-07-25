const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { adminMiddleware } = require('../middleware/auth');
const {
  ACTIVE_WEEKLY_THRESHOLD,
  GRACE_DAYS,
  INACTIVE_AFTER_DAYS,
  recomputeActiveStatus,
  isAdminUser,
  resolveEffectivePlan,
  defaultPlanExpiresAt,
  planMeta,
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
  const recentAgo = daysAgo(INACTIVE_AFTER_DAYS);
  const [
    weekActivity,
    weekLogins,
    weekAppUses,
    recentActivity,
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
    prisma.userActivity.count({ where: { userId: user.id, createdAt: { gte: recentAgo } } }),
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
  const meta = planMeta(user);
  const legal = (user.legalSettings && typeof user.legalSettings === 'object')
    ? user.legalSettings
    : {};

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
      : recentActivity > 0 || weekActivity >= ACTIVE_WEEKLY_THRESHOLD
        ? 'recent_activity'
        : 'inactive',
    activeGraceUntil: user.activeGraceUntil,
    lastActiveAt: user.lastActiveAt,
    createdAt: user.createdAt,
    plan: meta.plan,
    planRaw: meta.planRaw,
    planExpiresAt: meta.planExpiresAt,
    loginCount: meta.loginCount,
    premiumStars: meta.premiumStars,
    followupEmailSentAt: user.followupEmailSentAt || null,
    legalSettings: {
      marketingEmails: !!legal.marketingEmails,
      dataProcessing: legal.dataProcessing !== false,
      termsAccepted: !!legal.termsAccepted,
      analyticsOptIn: !!legal.analyticsOptIn,
      notes: typeof legal.notes === 'string' ? legal.notes : '',
    },
    weekActivityCount: weekActivity,
    recentActivityCount: recentActivity,
    weekLogins,
    weekAppUses,
    totalActivityCount: totalActivity,
    totalLogins,
    totalAppUses,
    profile: {
      name: user.name,
      email: user.email,
      role: isAdminUser(user) ? 'admin' : user.role,
      isDeveloper: user.isDeveloper,
      isVerified: user.isVerified,
      joinedAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      graceEndsAt: user.activeGraceUntil,
      plan: meta.plan,
      loginCount: meta.loginCount,
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
        plan: true,
        planExpiresAt: true,
        loginCount: true,
        followupEmailSentAt: true,
        legalSettings: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Refresh active flags for all users so dashboard is accurate
    await Promise.all(users.map((u) => recomputeActiveStatus(u.id, { touchLastActive: false })));

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
        plan: true,
        planExpiresAt: true,
        loginCount: true,
        followupEmailSentAt: true,
        legalSettings: true,
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
    const premiumUsers = refreshed.filter((u) => resolveEffectivePlan(u) === 'premium').length;
    const platinumUsers = refreshed.filter((u) => resolveEffectivePlan(u) === 'platinum').length;
    const commonUsers = refreshed.filter((u) => resolveEffectivePlan(u) === 'common').length;
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
        premiumUsers,
        platinumUsers,
        commonUsers,
        newThisWeek,
        newThisMonth,
        inGracePeriod: inGrace,
        weeklyActivityEvents: totalActivitiesWeek,
        weeklyLogins: weekLogins,
        weeklyAppUses: weekAppUses,
        activeThreshold: ACTIVE_WEEKLY_THRESHOLD,
        graceDays: GRACE_DAYS,
        inactiveAfterDays: INACTIVE_AFTER_DAYS,
      },
      // Only privacy-safe operational metrics — no passwords, codes, or content bodies
      ethicalDataPolicy: {
        collected: ['login events', 'throttled app_use pings', 'account profile fields', 'content counts', 'plan tier'],
        notCollected: ['passwords', 'verification codes', 'note/page content bodies', 'third-party tracking'],
        activeRule: `Active if activity within last ${INACTIVE_AFTER_DAYS} days, or ≥${ACTIVE_WEEKLY_THRESHOLD} events/week, or within first ${GRACE_DAYS} days of signup. Inactive users receive one SortLife follow-up email.`,
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
        plan: true,
        planExpiresAt: true,
        loginCount: true,
        followupEmailSentAt: true,
        legalSettings: true,
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

// PATCH /api/admin/users/:id — role, plan, active, legal settings
router.patch('/users/:id', async (req, res) => {
  try {
    const { role, isActive, plan, planExpiresAt, legalSettings, isDeveloper } = req.body;
    const data = {};
    if (role === 'admin' || role === 'user') data.role = role;
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (plan === 'common' || plan === 'premium' || plan === 'platinum') {
      data.plan = plan;
      if (plan === 'premium' && !planExpiresAt) {
        data.planExpiresAt = defaultPlanExpiresAt();
      }
    }
    if (planExpiresAt) {
      const d = new Date(planExpiresAt);
      if (!Number.isNaN(d.getTime())) data.planExpiresAt = d;
    }
    if (typeof isDeveloper === 'boolean') data.isDeveloper = isDeveloper;
    if (legalSettings && typeof legalSettings === 'object') {
      data.legalSettings = {
        marketingEmails: !!legalSettings.marketingEmails,
        dataProcessing: legalSettings.dataProcessing !== false,
        termsAccepted: !!legalSettings.termsAccepted,
        analyticsOptIn: !!legalSettings.analyticsOptIn,
        notes: typeof legalSettings.notes === 'string' ? legalSettings.notes.slice(0, 2000) : '',
      };
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Provide role, plan, isActive, isDeveloper, and/or legalSettings' });
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
