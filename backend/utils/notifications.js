/* ─── Notification preferences ─────────────────────────────
   A flat set of booleans plus a quiet-hours window. Kept in a
   JSON column so adding a channel needs no migration.      */

const DEFAULT_NOTIFICATION_PREFS = {
  /** Email: the Monday recap of the week just gone. */
  weeklySummary: true,
  /** Email: release notes and new features. */
  productUpdates: true,
  /** In-app: nudge for habits still unchecked late in the day. */
  habitReminders: true,
  /** In-app: a chime when a focus session ends. */
  focusChime: true,
  /** In-app: small sounds on completing things. */
  soundEffects: false,
  /** In-app: desktop notifications via the Notification API. */
  desktopNotifications: false,
  /** Suppress in-app nudges between these hours (24h, local). */
  quietHoursStart: 22,
  quietHoursEnd: 8,
};

const BOOLEAN_KEYS = Object.entries(DEFAULT_NOTIFICATION_PREFS)
  .filter(([, v]) => typeof v === 'boolean')
  .map(([k]) => k);

const HOUR_KEYS = ['quietHoursStart', 'quietHoursEnd'];

/** Merge a partial update over the stored prefs, dropping anything unknown. */
function sanitizeNotificationPrefs(body, existing = {}) {
  const out = { ...DEFAULT_NOTIFICATION_PREFS, ...existing };

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

module.exports = { DEFAULT_NOTIFICATION_PREFS, sanitizeNotificationPrefs };
