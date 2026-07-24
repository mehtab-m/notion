const prisma = require('../lib/prisma');

const ACTIVE_WEEKLY_THRESHOLD = 10;
const GRACE_DAYS = 7;
const APP_USE_THROTTLE_MS = 60 * 60 * 1000; // 1 hour between app_use logs

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function graceUntilFrom(createdAt) {
  return addDays(createdAt || new Date(), GRACE_DAYS);
}

/**
 * Recompute isActive for a user:
 * - Within grace period (first 7 days) → always active
 * - After grace → active if activity count in last 7 days >= 10
 */
async function recomputeActiveStatus(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const now = new Date();
  const graceUntil = user.activeGraceUntil || graceUntilFrom(user.createdAt);
  const weekAgo = addDays(now, -7);

  const weekCount = await prisma.userActivity.count({
    where: { userId, createdAt: { gte: weekAgo } },
  });

  const inGrace = now <= graceUntil;
  const isActive = inGrace || weekCount >= ACTIVE_WEEKLY_THRESHOLD;

  return prisma.user.update({
    where: { id: userId },
    data: {
      isActive,
      activeGraceUntil: user.activeGraceUntil || graceUntil,
      lastActiveAt: now,
    },
  });
}

/**
 * Log an activity event. For app_use, throttle to once per hour.
 */
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
      await prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      });
      return recent;
    }
  }

  await prisma.userActivity.create({
    data: { userId, type },
  });

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
  graceUntilFrom,
  recomputeActiveStatus,
  logActivity,
  isAdminUser,
};
