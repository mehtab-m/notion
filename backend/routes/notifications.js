/* ─── In-app notifications ─────────────────────────────────
   GET  /api/notifications?hour=19   live feed + unread count
   POST /api/notifications/read      { ids: [...] }
   POST /api/notifications/read-all
   POST /api/notifications/test-email   send this week's digest now  */

const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler, badRequest } = require('../middleware/errors');
const { buildFeed, markRead, sendWeeklyDigest } = require('../services/notifications');

const router = express.Router();

async function loadUser(req) {
  return prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, notificationPrefs: true, notificationState: true },
  });
}

/* The browser knows the user's local hour; the server may sit in another
   timezone. Fall back to server time when the client does not send it. */
function clientHour(req) {
  const h = parseInt(req.query.hour ?? req.body?.hour, 10);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : new Date().getHours();
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    const feed = await buildFeed(user, { hour: clientHour(req) });
    res.json({ items: feed.items, unread: feed.unread, quiet: feed.quiet });
  })
);

router.post(
  '/read',
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 200) : null;
    if (!ids) throw badRequest('ids must be a list');
    const user = await loadUser(req);
    await markRead(user, ids);
    res.json({ ok: true });
  })
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    const feed = await buildFeed(user, { hour: clientHour(req) });
    const ids = feed.items.map((n) => n.id);
    await markRead(user, ids, new Set(ids));
    res.json({ ok: true, cleared: ids.length });
  })
);

router.post(
  '/test-email',
  asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    const result = await sendWeeklyDigest(user, { force: true });
    if (!result.sent) {
      return res.status(503).json({
        error: result.reason === 'not_configured' || result.reason === 'from_not_configured'
          ? 'Email is not configured on the server (BREVO_API_KEY / BREVO_FROM_EMAIL).'
          : `Email could not be sent: ${result.reason}`,
      });
    }
    res.json({ ok: true, message: `Sent your weekly summary to ${user.email}` });
  })
);

module.exports = router;
