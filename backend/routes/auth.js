const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { signToken, authMiddleware } = require('../middleware/auth');
const { asyncHandler, badRequest, unauthorized, notFoundError } = require('../middleware/errors');
const { authLimiter, verifyLimiter, resendLimiter, passwordLimiter } = require('../middleware/rateLimit');
const { sendVerificationEmail } = require('../utils/email');
const { seedDefaultHabits } = require('../utils/defaultHabits');
const { graceUntilFrom, logActivity, isAdminUser, defaultPlanExpiresAt, planMeta, resolveEffectivePlan } = require('../utils/activity');

const router = express.Router();

const MIN_PASSWORD = 8;
/* bcryptjs is the pure-JS build: cost 11 takes ~1.1s and cost 12 ~2.3s
   on this hardware, and it blocks the event loop while it runs. 10 is
   the ceiling that keeps sign-in responsive under concurrency. */
const BCRYPT_ROUNDS = 10;
const CODE_TTL_MS = 15 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* A real hash of a value nobody can supply. Comparing against it keeps
   the "unknown email" path as slow as a genuine check — a malformed
   placeholder would be rejected instantly and leak the difference.
   Computed once at boot (~250ms), never on the request path. */
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);

/** Cryptographically uniform 6-digit code (Math.random is not). */
function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

/** Compare confirmation codes without leaking position via timing. */
function codeMatches(expected, provided) {
  if (typeof expected !== 'string' || typeof provided !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizeEmail(value) {
  return String(value || '').toLowerCase().trim();
}

function assertPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    throw badRequest(`Password must be at least ${MIN_PASSWORD} characters`);
  }
  if (password.length > 200) {
    throw badRequest('Password is too long');
  }
}

function publicUser(user) {
  const meta = planMeta(user);
  return {
    _id: user.id,
    name: user.name,
    email: user.email,
    isDeveloper: user.isDeveloper ?? null,
    role: isAdminUser(user) ? 'admin' : (user.role || 'user'),
    isActive: user.isActive ?? true,
    activeGraceUntil: user.activeGraceUntil || null,
    lastActiveAt: user.lastActiveAt || null,
    plan: meta.plan,
    planRaw: meta.planRaw,
    planExpiresAt: meta.planExpiresAt,
    loginCount: meta.loginCount,
    premiumStars: meta.premiumStars,
    premiumStarHolders: meta.premiumStarHolders,
    showPremiumWelcome: meta.showPremiumWelcome,
    legalSettings: user.legalSettings || {},
    createdAt: user.createdAt,
  };
}

// POST /api/auth/signup
router.post(
  '/signup',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    const trimmedName = String(name || '').trim();
    if (!trimmedName) throw badRequest('Name is required');

    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_RE.test(normalizedEmail)) throw badRequest('Enter a valid email address');
    assertPassword(password);

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing?.isVerified) {
      throw badRequest('Email already registered. Please log in.');
    }

    const code = generateCode();
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const expires = new Date(Date.now() + CODE_TTL_MS);
    const now = new Date();

    if (existing) {
      // An unverified signup being retried — refresh the pending record.
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: trimmedName,
          password: hashed,
          verificationCode: code,
          verificationExpires: expires,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          name: trimmedName,
          email: normalizedEmail,
          password: hashed,
          verificationCode: code,
          verificationExpires: expires,
          isActive: true,
          activeGraceUntil: graceUntilFrom(now),
          plan: 'premium',
          planExpiresAt: defaultPlanExpiresAt(),
          loginCount: 0,
          legalSettings: {},
        },
      });
    }

    res.status(201).json({
      message: 'Account created. Check your email for the confirmation code.',
      email: normalizedEmail,
    });

    // Fire-and-forget: a slow mail provider must not stall the response.
    sendVerificationEmail(normalizedEmail, trimmedName, code)
      .then((result) => {
        if (!result.sent) console.warn('Signup email not delivered:', result.reason);
      })
      .catch((err) => console.warn('Signup email failed:', err.message));
  })
);

// POST /api/auth/verify
router.post(
  '/verify',
  verifyLimiter,
  asyncHandler(async (req, res) => {
    const { email, code } = req.body || {};
    if (!email || !code) throw badRequest('Email and code are required');

    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (!user) throw notFoundError('User not found');

    if (user.isVerified) {
      const refreshed = await logActivity(user.id, 'login');
      return res.json({ token: signToken(user.id), user: publicUser(refreshed || user) });
    }

    if (!user.verificationExpires || user.verificationExpires < new Date()) {
      throw badRequest('Code expired. Request a new one.');
    }
    if (!codeMatches(user.verificationCode, String(code).trim())) {
      throw badRequest('Invalid confirmation code');
    }

    const verified = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationCode: null,
        verificationExpires: null,
        isActive: true,
        activeGraceUntil: user.activeGraceUntil || graceUntilFrom(user.createdAt),
        plan: user.plan || 'premium',
        planExpiresAt: user.planExpiresAt || defaultPlanExpiresAt(),
      },
    });

    await seedDefaultHabits(prisma, verified.id);
    const refreshed = await logActivity(verified.id, 'login');

    res.json({ token: signToken(verified.id), user: publicUser(refreshed || verified) });
  })
);

// POST /api/auth/resend
router.post(
  '/resend',
  resendLimiter,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(req.body?.email) } });
    if (!user) throw notFoundError('User not found');
    if (user.isVerified) throw badRequest('Already verified. Please log in.');

    const code = generateCode();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode: code,
        verificationExpires: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    res.json({ message: 'New code sent' });

    sendVerificationEmail(user.email, user.name, code)
      .then((result) => {
        if (!result.sent) console.warn('Resend email not delivered:', result.reason);
      })
      .catch((err) => console.warn('Resend email failed:', err.message));
  })
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) throw badRequest('Email and password are required');

    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });

    // Always run the comparison so response time does not reveal which
    // addresses are registered.
    const match = await bcrypt.compare(String(password), user?.password || DUMMY_HASH);
    if (!user || !match) throw unauthorized('Invalid email or password');

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ error: 'Email not verified', needsVerification: true, email: user.email });
    }

    // Backfill grace + premium windows for accounts created before them.
    let readyUser = user;
    const patch = {};
    if (!user.activeGraceUntil) patch.activeGraceUntil = graceUntilFrom(user.createdAt);
    if (!user.planExpiresAt) {
      patch.plan = user.plan || 'premium';
      patch.planExpiresAt = defaultPlanExpiresAt();
    } else {
      patch.plan = resolveEffectivePlan(user);
    }
    if (Object.keys(patch).length) {
      readyUser = await prisma.user.update({ where: { id: user.id }, data: patch });
    }

    // logActivity hands back the updated row, so no follow-up read.
    const refreshed = await logActivity(readyUser.id, 'login');
    const finalUser = refreshed || readyUser;

    res.json({ token: signToken(finalUser.id), user: publicUser(finalUser) });
  })
);

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// PATCH /api/auth/preferences — set developer status (once or update)
router.patch(
  '/preferences',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { isDeveloper } = req.body || {};
    if (typeof isDeveloper !== 'boolean') {
      throw badRequest('isDeveloper must be true or false');
    }
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { isDeveloper },
    });
    res.json({ user: publicUser(updated) });
  })
);

// POST /api/auth/ping — record app usage for active-user analysis
router.post(
  '/ping',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await logActivity(req.user.id, 'app_use');
    res.json({ ok: true, user: publicUser(user || req.user) });
  })
);

// PATCH /api/auth/profile — name + email (role cannot be changed)
router.patch(
  '/profile',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { name, email } = req.body || {};
    const data = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (typeof email === 'string' && email.trim()) {
      const normalized = normalizeEmail(email);
      if (!EMAIL_RE.test(normalized)) throw badRequest('Invalid email address');
      const taken = await prisma.user.findFirst({
        where: { email: normalized, NOT: { id: req.user.id } },
        select: { id: true },
      });
      if (taken) throw badRequest('Email already in use');
      data.email = normalized;
    }
    if (Object.keys(data).length === 0) throw badRequest('Provide name and/or email');

    const updated = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({ user: publicUser(updated) });
  })
);

// PATCH /api/auth/password
router.patch(
  '/password',
  authMiddleware,
  passwordLimiter,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      throw badRequest('Current and new password are required');
    }
    assertPassword(newPassword);
    if (currentPassword === newPassword) {
      throw badRequest('New password must be different from the current one');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, password: true },
    });
    const match = await bcrypt.compare(String(currentPassword), user.password);
    if (!match) throw badRequest('Current password is incorrect');

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    });
    res.json({ message: 'Password updated' });
  })
);

module.exports = router;
module.exports.MIN_PASSWORD = MIN_PASSWORD;
