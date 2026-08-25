/* ─── Rate limiting ────────────────────────────────────────
   The auth endpoints are the ones worth protecting: a 6-digit
   confirmation code is only 10^6 wide, so an unthrottled
   /verify is guessable. Authenticated traffic is keyed by user
   id so one busy user cannot lock out everyone behind a shared
   corporate NAT.                                             */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const MINUTE = 60 * 1000;
const DISABLED = process.env.DISABLE_RATE_LIMIT === 'true';

/* Skip limiting entirely in test runs / local opt-out. */
const skip = () => DISABLED;

function limiter({ windowMs, limit, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    skip,
    keyGenerator,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      const retryAfter = Math.ceil((req.rateLimit?.resetTime - Date.now()) / 1000) || 60;
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({ error: message, retryAfter });
    },
  });
}

/* Key on IP + submitted email so one attacker cannot burn
   through a victim's allowance from a rotating address, and
   cannot spread an attack on one account across many. */
const emailAndIpKey = (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  return `${ipKeyGenerator(req, res)}:${email}`;
};

const userOrIpKey = (req, res) =>
  req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req, res);

/* Sign-in / sign-up attempts. */
const authLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 10,
  message: 'Too many attempts. Please wait a few minutes and try again.',
  keyGenerator: emailAndIpKey,
});

/* Confirmation-code checks — the brute-force surface. */
const verifyLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 8,
  message: 'Too many confirmation attempts. Request a new code in a few minutes.',
  keyGenerator: emailAndIpKey,
});

/* Outbound email costs money and annoys the recipient. */
const resendLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 3,
  message: 'You can request another code in a few minutes.',
  keyGenerator: emailAndIpKey,
});

/* Password changes, keyed to the signed-in user. */
const passwordLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 8,
  message: 'Too many password attempts. Please wait a few minutes.',
  keyGenerator: userOrIpKey,
});

/* Broad ceiling for the authenticated API — generous enough
   that normal use never sees it. */
const apiLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 1500,
  message: 'Slow down a moment — too many requests.',
  keyGenerator: userOrIpKey,
});

/* File uploads are the expensive write path. */
const uploadLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 60,
  message: 'Too many uploads. Please wait a few minutes.',
  keyGenerator: userOrIpKey,
});

module.exports = {
  authLimiter,
  verifyLimiter,
  resendLimiter,
  passwordLimiter,
  apiLimiter,
  uploadLimiter,
};
