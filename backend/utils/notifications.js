/* ─── Notification preferences ─────────────────────────────
   A flat set of booleans plus a quiet-hours window. Kept in a
   JSON column so adding a channel needs no migration. Every
   key here is acted on by the server: email digests by
   services/notifications.js, in-app alerts by GET /api/notifications. */

const DEFAULT_NOTIFICATION_PREFS = {
  /** Email: the Monday recap of the week just gone. */
  weeklySummary: true,
  /** Email: release notes and new features. */
  productUpdates: true,
  /** In-app: nudge for habits still unchecked late in the day. */
  habitReminders: true,
  /** In-app: overdue / due-today inbox items, goal follow-ups and sub-goals. */
  deadlineAlerts: true,
  /** In-app: a chime when a focus session ends. */
  focusChime: true,
  /** In-app: small sounds on completing things. */
  soundEffects: false,
  /** Suppress in-app nudges between these hours (24h, local). */
  quietHoursStart: 22,
  quietHoursEnd: 8,
};

const BOOLEAN_KEYS = Object.entries(DEFAULT_NOTIFICATION_PREFS)
  .filter(([, v]) => typeof v === 'boolean')
  .map(([k]) => k);

const HOUR_KEYS = ['quietHoursStart', 'quietHoursEnd'];

/** Only known keys survive — retired ones (e.g. desktopNotifications) drop out. */
function pickKnown(prefs = {}) {
  const out = { ...DEFAULT_NOTIFICATION_PREFS };
  for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFS)) {
    if (prefs[key] !== undefined) out[key] = prefs[key];
  }
  return out;
}

/** Merge a partial update over the stored prefs, dropping anything unknown. */
function sanitizeNotificationPrefs(body, existing = {}) {
  const out = pickKnown(existing);

  for (const key of BOOLEAN_KEYS) {
    if (body[key] === undefined) continue;
    out[key] = body[key] === true || body[key] === 'true';
  }

  for (const key of HOUR_KEYS) {
    if (body[key] === undefined) continue;
    const hour = Math.round(Number(body[key]));
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
      const err = new Error(`${key} must be an hour between 0 and 23`);
      err.status = 400;
      throw err;
    }
    out[key] = hour;
  }

  return out;
}

/** True when `hour` falls inside the quiet window (which may wrap midnight). */
function inQuietHours(prefs, hour) {
  const start = prefs.quietHoursStart ?? 22;
  const end = prefs.quietHoursEnd ?? 8;
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

module.exports = { DEFAULT_NOTIFICATION_PREFS, sanitizeNotificationPrefs, pickKnown, inQuietHours };
