const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { isAdminUser } = require('../utils/activity');

/* A hardcoded fallback secret in production means anyone who has read
   this file can mint a valid token for any account. Fail at boot
   instead of shipping that silently. */
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES = '7d';

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  isVerified: true,
  isDeveloper: true,
  role: true,
  isActive: true,
  activeGraceUntil: true,
  lastActiveAt: true,
  plan: true,
  planExpiresAt: true,
  loginCount: true,
  followupEmailSentAt: true,
  legalSettings: true,
  themeSettings: true,
  notificationPrefs: true,
  avatarUrl: true,
  createdAt: true,
};

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: USER_SELECT,
    });
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.isVerified) return res.status(403).json({ error: 'Email not verified' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminMiddleware(req, res, next) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function developerMiddleware(req, res, next) {
  if (req.user?.isDeveloper !== true) {
    return res.status(403).json({ error: 'Developer access required for projects' });
  }
  next();
}

module.exports = {
  authMiddleware,
  adminMiddleware,
  developerMiddleware,
  signToken,
  JWT_SECRET,
  USER_SELECT,
};
