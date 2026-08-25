/* ─── Archive & Trash ──────────────────────────────────────
   Content models carry `archivedAt` and `deletedAt` instead of
   being removed outright, so a delete stays undoable. Every
   list query has to opt out of the tombstones — these helpers
   keep that decision in one place rather than scattering
   `deletedAt: null` across a dozen routes.               */

const { owned } = require('./scope');

/** Days a trashed record survives before it can be purged. */
const TRASH_TTL_DAYS = 30;

/** Live records: not trashed, not archived. The default list view. */
function active(req, extra = {}) {
  return owned(req, { ...extra, deletedAt: null, archivedAt: null });
}

/** Everything the user still owns, archived included — but not trashed. */
function notTrashed(req, extra = {}) {
  return owned(req, { ...extra, deletedAt: null });
}

/** Only what sits in the archive. */
function archivedOnly(req, extra = {}) {
  return owned(req, { ...extra, deletedAt: null, NOT: { archivedAt: null } });
}

/** Only what sits in the trash. */
function trashedOnly(req, extra = {}) {
  return owned(req, { ...extra, NOT: { deletedAt: null } });
}

/** The cutoff before which trashed rows are eligible for a real delete. */
function purgeCutoff(days = TRASH_TTL_DAYS) {
  return new Date(Date.now() - days * 86400000);
}

/**
 * The models that participate in archive/trash, keyed by the `type`
 * the frontend uses. `titleField` is what the Archive list renders.
 */
const LIFECYCLE_MODELS = {
  note:    { model: 'note',        label: 'Note',        titleField: 'title' },
  book:    { model: 'book',        label: 'Book',        titleField: 'title' },
  show:    { model: 'show',        label: 'Show',        titleField: 'title' },
  table:   { model: 'spreadsheet', label: 'Table',       titleField: 'name' },
  habit:   { model: 'habit',       label: 'Habit',       titleField: 'name' },
  goal:    { model: 'goal',        label: 'Goal',        titleField: 'title' },
  sticky:  { model: 'stickyNote',  label: 'Sticky Note', titleField: 'content' },
};

module.exports = {
  TRASH_TTL_DAYS,
  active,
  notTrashed,
  archivedOnly,
  trashedOnly,
  purgeCutoff,
  LIFECYCLE_MODELS,
};
