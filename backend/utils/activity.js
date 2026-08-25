const prisma = require('../lib/prisma');
const { sendInactiveFollowupEmail } = require('./email');

const ACTIVE_WEEKLY_THRESHOLD = 10;
/** New accounts stay active for this many days regardless of usage */
const GRACE_DAYS = 7;
/** After grace: inactive if no login/app_use within this many days */
const INACTIVE_AFTER_DAYS = 3;
const APP_USE_THROTTLE_MS = 60 * 60 * 1000;
const DEFAULT_PREMIUM_UNTIL = new Date('2027-03-15T23:59:59.000Z');
const PREMIUM_STARS = 3;
const PREMIUM_STAR_HOLDERS = 5;
const PREMIUM_ANIMATION_MAX_LOGINS = 10;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function graceUntilFrom(createdAt) {
  return addDays(createdAt || new Date(), GRACE_DAYS);
}

function defaultPlanExpiresAt() {
  return new Date(DEFAULT_PREMIUM_UNTIL);
}

/**
 * Resolve effective plan:
 * - platinum always stays platinum
 * - after planExpiresAt (default Mar 15 2027) → common
 * - otherwise premium (default for all users until that date)
 */
function resolveEffectivePlan(user) {
  if (!user) return 'common';
  const raw = (user.plan || 'premium').toLowerCase();
  if (raw === 'platinum') return 'platinum';

  const now = new Date();
  const expires = user.planExpiresAt
    ? new Date(user.planExpiresAt)
    : DEFAULT_PREMIUM_UNTIL;

  if (now > expires) return 'common';
  if (raw === 'common' && now <= DEFAULT_PREMIUM_UNTIL && !user.planExpiresAt) {
    return 'premium';
  }
  if (raw === 'common') return 'common';
  return 'premium';
}

function planMeta(user) {
  const effectivePlan = resolveEffectivePlan(user);
  const loginCount = user?.loginCount || 0;
  return {
    plan: effectivePlan,
    planRaw: user?.plan || 'premium',
    planExpiresAt: user?.planExpiresAt || DEFAULT_PREMIUM_UNTIL,
    loginCount,
    premiumStars: effectivePlan === 'common' ? 1 : effectivePlan === 'platinum' ? 5 : PREMIUM_STARS,
    premiumStarHolders: PREMIUM_STAR_HOLDERS,
    showPremiumWelcome:
      effectivePlan === 'premium' || effectivePlan === 'platinum'
        ? loginCount > 0 && loginCount <= PREMIUM_ANIMATION_MAX_LOGINS
        : false,
  };
}

/**
 * Recompute isActive:
 * - Within grace → always active
 * - Else active if any activity in last INACTIVE_AFTER_DAYS (3)
 * - Also keep weekly threshold as secondary signal
 * When flipping to inactive, send one follow-up email.
 */
async function recomputeActiveStatus(userId, { touchLastActive = true } = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const now = new Date();
  const graceUntil = user.activeGraceUntil || graceUntilFrom(user.createdAt);
  const inactiveSince = addDays(now, -INACTIVE_AFTER_DAYS);
  const weekAgo = addDays(now, -7);

  const [recentCount, weekCount] = await Promise.all([
    prisma.userActivity.count({
      where: { userId, createdAt: { gte: inactiveSince } },
    }),
    prisma.userActivity.count({
      where: { userId, createdAt: { gte: weekAgo } },
    }),
  ]);

  const inGrace = now <= graceUntil;
  const recentlyActive = recentCount > 0
    || (user.lastActiveAt && new Date(user.lastActiveAt) >= inactiveSince);
  const isActive = inGrace || recentlyActive || weekCount >= ACTIVE_WEEKLY_THRESHOLD;

  const wasActive = user.isActive !== false;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isActive,
      activeGraceUntil: user.activeGraceUntil || graceUntil,
      ...(touchLastActive && isActive ? { lastActiveAt: now } : {}),
      plan: resolveEffectivePlan({ ...user, plan: user.plan }),
      planExpiresAt: user.planExpiresAt || defaultPlanExpiresAt(),
    },
  });

  if (wasActive && !isActive && !user.followupEmailSentAt) {
    sendInactiveFollowupEmail(user.email, user.name).then(async (result) => {
      if (result?.sent) {
        await prisma.user.update({
          where: { id: userId },
          data: { followupEmailSentAt: new Date() },
        });
      }
    }).catch(() => {});
  }

  // Reset followup flag when user becomes active again so a future lapse can notify once more
  if (!wasActive && isActive && user.followupEmailSentAt) {
    await prisma.user.update({
      where: { id: userId },
      data: { followupEmailSentAt: null },
    });
  }

  return updated;
}

/** Send the one-off "we miss you" mail when a user lapses. */
function queueInactiveFollowup(user) {
  sendInactiveFollowupEmail(user.email, user.name)
    .then(async (result) => {
      if (result?.sent) {
        await prisma.user.update({
          where: { id: user.id },
          data: { followupEmailSentAt: new Date() },
        });
      }
    })
    .catch(() => {});
}

/**
 * Same rules as recomputeActiveStatus, but for a whole list of users in
 * a fixed number of queries. The per-user version costs four round
 * trips each, which turned the admin dashboard into thousands of
 * concurrent queries once the user table grew.
 *
 * Returns the users with their recomputed fields applied.
 */
async function recomputeActiveStatusBatch(users, { touchLastActive = false } = {}) {
  if (!users?.length) return [];

  const now = new Date();
  const inactiveSince = addDays(now, -INACTIVE_AFTER_DAYS);
  const weekAgo = addDays(now, -7);
  const userIds = users.map((u) => u.id);

  const [recentRows, weekRows] = await Promise.all([
    prisma.userActivity.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, createdAt: { gte: inactiveSince } },
      _count: { _all: true },
    }),
    prisma.userActivity.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, createdAt: { gte: weekAgo } },
      _count: { _all: true },
    }),
  ]);

  const recentBy = new Map(recentRows.map((r) => [r.userId, r._count._all]));
  const weekBy = new Map(weekRows.map((r) => [r.userId, r._count._all]));

  const updates = [];
  const resolved = users.map((user) => {
    const graceUntil = user.activeGraceUntil || graceUntilFrom(user.createdAt);
    const inGrace = now <= new Date(graceUntil);
    const recentCount = recentBy.get(user.id) || 0;
    const weekCount = weekBy.get(user.id) || 0;
    const recentlyActive =
      recentCount > 0 || (user.lastActiveAt && new Date(user.lastActiveAt) >= inactiveSince);
    const isActive = inGrace || !!recentlyActive || weekCount >= ACTIVE_WEEKLY_THRESHOLD;

    const plan = resolveEffectivePlan(user);
    const planExpiresAt = user.planExpiresAt || defaultPlanExpiresAt();

    const wasActive = user.isActive !== false;

    // Clearing the flag on recovery lets a future lapse notify once more,
    // matching the single-user path.
    const clearFollowup = !wasActive && isActive && user.followupEmailSentAt;

    // Only write rows that actually changed.
    if (
      user.isActive !== isActive ||
      !user.activeGraceUntil ||
      user.plan !== plan ||
      !user.planExpiresAt ||
      clearFollowup
    ) {
      updates.push({
        id: user.id,
        data: {
          isActive,
          activeGraceUntil: graceUntil,
          plan,
          planExpiresAt,
          ...(clearFollowup ? { followupEmailSentAt: null } : {}),
          ...(touchLastActive && isActive ? { lastActiveAt: now } : {}),
        },
      });
    }

    if (wasActive && !isActive && !user.followupEmailSentAt) {
      queueInactiveFollowup(user);
    }

    return { ...user, isActive, activeGraceUntil: graceUntil, plan, planExpiresAt, recentCount, weekCount };
  });

  if (updates.length) {
    await prisma.$transaction(
      updates.map((u) => prisma.user.update({ where: { id: u.id }, data: u.data }))
    );
  }

  return resolved;
}

/** Records activity and returns the freshly-updated user record. */
async function logActivity(userId, type = 'app_use') {
  if (!userId) return null;

  if (type === 'app_use') {
    const recent = await prisma.userActivity.findFirst({
      where: {
        userId,
        type: 'app_use',
        createdAt: { gte: new Date(Date.now() - APP_USE_THROTTLE_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      // Already counted inside the throttle window: bump the timestamp
      // and hand the user back so callers need no follow-up read.
      return prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      });
    }
  }

  await prisma.userActivity.create({
    data: { userId, type },
  });

  if (type === 'login') {
    await prisma.user.update({
      where: { id: userId },
      data: { loginCount: { increment: 1 } },
    });
  }

  return recomputeActiveStatus(userId);
}

function isAdminUser(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes((user.email || '').toLowerCase());
}

module.exports = {
  ACTIVE_WEEKLY_THRESHOLD,
  GRACE_DAYS,
  INACTIVE_AFTER_DAYS,
  DEFAULT_PREMIUM_UNTIL,
  PREMIUM_STARS,
  PREMIUM_STAR_HOLDERS,
  PREMIUM_ANIMATION_MAX_LOGINS,
  graceUntilFrom,
  defaultPlanExpiresAt,
  resolveEffectivePlan,
  planMeta,
  recomputeActiveStatus,
  recomputeActiveStatusBatch,
  logActivity,
  isAdminUser,
};
