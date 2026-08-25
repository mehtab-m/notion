const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { adminMiddleware } = require('../middleware/auth');
const {
  ACTIVE_WEEKLY_THRESHOLD,
  GRACE_DAYS,
  INACTIVE_AFTER_DAYS,
  recomputeActiveStatusBatch,
  isAdminUser,
  resolveEffectivePlan,
  defaultPlanExpiresAt,
  planMeta,
} = require('../utils/activity');
const { serialize } = require('../utils/serialize');
const { asyncHandler, badRequest } = require('../middleware/errors');

router.use(adminMiddleware);

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/* Never select password, verificationCode or resetCode into an admin
   payload — the dashboard has no use for them. */
const USER_ANALYTICS_SELECT = {
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
};

/** Sum a groupBy result into a Map keyed by userId. */
function countByUser(rows) {
  return new Map(rows.map((r) => [r.userId, r._count._all]));
}

/** Nested Map: userId -> activity type -> count. */
function countByUserAndType(rows) {
  const out = new Map();
  for (const r of rows) {
    if (!out.has(r.userId)) out.set(r.userId, {});
    out.get(r.userId)[r.type] = r._count._all;
  }
  return out;
}

/**
 * Analytics for a list of users in a fixed 11 queries.
 *
 * The per-user version issued 15 queries each and was called inside a
 * Promise.all over every verified user, so the admin dashboard fired
 * 15 x N concurrent queries and exhausted the connection pool.
 */
async function buildUserAnalyticsBatch(users) {
  if (!users?.length) return [];

  const weekAgo = daysAgo(7);
  const recentAgo = daysAgo(INACTIVE_AFTER_DAYS);
  const userId = { in: users.map((u) => u.id) };
  const tally = (model) =>
    prisma[model].groupBy({ by: ['userId'], where: { userId }, _count: { _all: true } });

  const [
    weekByType,
    recentAll,
    totalByType,
    books, shows, habits, goals, projects, notes, tables, stickyNotes,
  ] = await Promise.all([
    prisma.userActivity.groupBy({
      by: ['userId', 'type'],
      where: { userId, createdAt: { gte: weekAgo } },
      _count: { _all: true },
    }),
    prisma.userActivity.groupBy({
      by: ['userId'],
      where: { userId, createdAt: { gte: recentAgo } },
      _count: { _all: true },
    }),
    prisma.userActivity.groupBy({
      by: ['userId', 'type'],
      where: { userId },
      _count: { _all: true },
    }),
    tally('book'),
    tally('show'),
    tally('habit'),
    tally('goal'),
    tally('project'),
    tally('note'),
    tally('spreadsheet'),
    tally('stickyNote'),
  ]);

  const week = countByUserAndType(weekByType);
  const total = countByUserAndType(totalByType);
  const recent = countByUser(recentAll);
  const content = {
    books: countByUser(books),
    shows: countByUser(shows),
    habits: countByUser(habits),
    goals: countByUser(goals),
    projects: countByUser(projects),
    notes: countByUser(notes),
    tables: countByUser(tables),
    stickyNotes: countByUser(stickyNotes),
  };

  const now = new Date();

  return users.map((user) => {
    const w = week.get(user.id) || {};
    const t = total.get(user.id) || {};
    const weekLogins = w.login || 0;
    const weekAppUses = w.app_use || 0;
    const weekActivity = weekLogins + weekAppUses;
    const totalLogins = t.login || 0;
    const totalAppUses = t.app_use || 0;
    const recentActivity = recent.get(user.id) || 0;

    const inGrace = user.activeGraceUntil ? now <= new Date(user.activeGraceUntil) : false;
    const meta = planMeta(user);
    const legal =
      user.legalSettings && typeof user.legalSettings === 'object' ? user.legalSettings : {};

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
      totalActivityCount: totalLogins + totalAppUses,
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
        books: content.books.get(user.id) || 0,
        shows: content.shows.get(user.id) || 0,
        habits: content.habits.get(user.id) || 0,
        goals: content.goals.get(user.id) || 0,
        projects: content.projects.get(user.id) || 0,
        notes: content.notes.get(user.id) || 0,
        tables: content.tables.get(user.id) || 0,
        stickyNotes: content.stickyNotes.get(user.id) || 0,
      },
    };
  });
}

/** Single-user convenience wrapper. */
async function buildUserAnalytics(user) {
  const [row] = await buildUserAnalyticsBatch([user]);
  return row;
}

// GET /api/admin/stats — product overview
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const weekAgo = daysAgo(7);
    const monthAgo = daysAgo(30);

    const users = await prisma.user.findMany({
      where: { isVerified: true },
      select: USER_ANALYTICS_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    // Refresh active flags in one batch. The batch returns the updated
    // rows, so the second full read of the user table is unnecessary.
    const refreshed = await recomputeActiveStatusBatch(users, { touchLastActive: false });

    const userRows = await buildUserAnalyticsBatch(refreshed);

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
  })
);

// GET /api/admin/users — list users with analytics
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { isVerified: true },
      select: USER_ANALYTICS_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    res.json(serialize(await buildUserAnalyticsBatch(users)));
  })
);

// PATCH /api/admin/users/:id — role, plan, active, legal settings
router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const { role, isActive, plan, planExpiresAt, legalSettings, isDeveloper } = req.body || {};
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
      throw badRequest('Provide role, plan, isActive, isDeveloper, and/or legalSettings');
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: USER_ANALYTICS_SELECT,
    });
    res.json({ user: await buildUserAnalytics(updated) });
  })
);

module.exports = router;
