/* ─── Export & Import ──────────────────────────────────────
   A user's data should never be locked in here. Export gives
   back a single JSON document (or a CSV per collection);
   import replays one of those documents into a fresh account. */

const express = require('express');
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { notTrashed } = require('../utils/lifecycle');
const { serialize } = require('../utils/serialize');
const { asyncHandler, badRequest } = require('../middleware/errors');

const router = express.Router();

const EXPORT_VERSION = 1;

/* Columns worth carrying across. Ids and userIds are deliberately
   dropped — an import creates new rows owned by the importer. */
const COLLECTIONS = {
  notes: {
    model: 'note',
    scoped: true,
    fields: ['title', 'content', 'folder', 'tags', 'pinned', 'color', 'isNotebook', 'blocks', 'order', 'favorite', 'createdAt'],
    csv: ['title', 'folder', 'tags', 'pinned', 'createdAt'],
  },
  books: {
    model: 'book',
    scoped: true,
    fields: ['title', 'author', 'status', 'currentPage', 'totalPages', 'rating', 'genre', 'notes', 'coverImage', 'tags', 'favorite', 'startedAt', 'finishedAt', 'createdAt'],
    csv: ['title', 'author', 'status', 'currentPage', 'totalPages', 'rating', 'genre'],
  },
  shows: {
    model: 'show',
    scoped: true,
    fields: ['title', 'mediaType', 'platform', 'status', 'currentSeason', 'currentEpisode', 'totalSeasons', 'rating', 'genre', 'notes', 'posterImage', 'tags', 'favorite', 'createdAt'],
    csv: ['title', 'mediaType', 'platform', 'status', 'currentSeason', 'currentEpisode', 'rating'],
  },
  habits: {
    model: 'habit',
    scoped: true,
    fields: ['name', 'description', 'icon', 'color', 'frequency', 'completedDates', 'streak', 'tags', 'favorite', 'createdAt'],
    csv: ['name', 'frequency', 'streak', 'createdAt'],
  },
  goals: {
    model: 'goal',
    scoped: true,
    fields: ['title', 'description', 'why', 'category', 'status', 'horizon', 'icon', 'progress', 'momentum', 'targetDate', 'milestones', 'achievements', 'tags', 'favorite', 'createdAt'],
    csv: ['title', 'category', 'status', 'horizon', 'progress', 'targetDate'],
  },
  tables: {
    model: 'spreadsheet',
    scoped: true,
    fields: ['name', 'columns', 'rows', 'tags', 'favorite', 'createdAt'],
    csv: ['name', 'createdAt'],
  },
  stickyNotes: {
    model: 'stickyNote',
    scoped: true,
    fields: ['content', 'color', 'pinned', 'posX', 'posY', 'tags', 'favorite', 'createdAt'],
    csv: ['content', 'color', 'pinned', 'createdAt'],
  },
  inbox: {
    model: 'inboxItem',
    scoped: false,
    fields: ['text', 'note', 'tags', 'status', 'pinned', 'priority', 'dueDate', 'createdAt'],
    csv: ['text', 'status', 'priority', 'dueDate', 'createdAt'],
  },
  focusSessions: {
    model: 'focusSession',
    scoped: false,
    fields: ['kind', 'minutes', 'seconds', 'completed', 'label', 'startedAt', 'endedAt'],
    csv: ['kind', 'minutes', 'seconds', 'completed', 'label', 'startedAt'],
  },
};

/** Escape one CSV cell — quotes doubled, anything risky wrapped. */
function csvCell(value) {
  if (value == null) return '';
  let out;
  if (Array.isArray(value)) out = value.join('; ');
  else if (value instanceof Date) out = value.toISOString();
  else if (typeof value === 'object') out = JSON.stringify(value);
  else out = String(value);

  /* A leading =, +, - or @ makes Excel treat the cell as a formula.
     Prefixing an apostrophe keeps it text. */
  if (/^[=+\-@]/.test(out)) out = `'${out}`;
  return /[",\n\r]/.test(out) ? `"${out.replace(/"/g, '""')}"` : out;
}

function toCsv(rows, fields) {
  const header = fields.join(',');
  const body = rows.map((row) => fields.map((f) => csvCell(row[f])).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

/** Pull one collection, honouring its scope helper. */
async function fetchCollection(req, key, spec, { includeTrashed = false } = {}) {
  const delegate = prisma[spec.model];
  if (!delegate) return [];
  const where = spec.scoped && !includeTrashed ? notTrashed(req) : owned(req);
  return delegate.findMany({
    where,
    select: Object.fromEntries(spec.fields.map((f) => [f, true])),
    take: 5000,
  });
}

// GET /api/data/export — the whole account as one JSON document
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const only = String(req.query.only || '').trim();
    const keys = only
      ? only.split(',').map((k) => k.trim()).filter((k) => COLLECTIONS[k])
      : Object.keys(COLLECTIONS);
    if (!keys.length) throw badRequest('No valid collections requested');

    const data = {};
    for (const key of keys) {
      data[key] = await fetchCollection(req, key, COLLECTIONS[key]);
    }

    const payload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'SortLife',
      account: { name: req.user.name, email: req.user.email },
      counts: Object.fromEntries(keys.map((k) => [k, data[k].length])),
      data,
    };

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sortlife-export-${stamp}.json"`);
    res.send(JSON.stringify(serialize(payload), null, 2));
  })
);

// GET /api/data/export.csv?collection=books
router.get(
  '/export.csv',
  asyncHandler(async (req, res) => {
    const key = String(req.query.collection || '');
    const spec = COLLECTIONS[key];
    if (!spec) {
      throw badRequest(
        `Unknown collection "${key}". Expected one of: ${Object.keys(COLLECTIONS).join(', ')}`
      );
    }
    const rows = await fetchCollection(req, key, spec);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sortlife-${key}-${stamp}.csv"`);
    res.send(toCsv(rows, spec.csv));
  })
);

// GET /api/data/summary — row counts, for the export screen
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const entries = await Promise.all(
      Object.entries(COLLECTIONS).map(async ([key, spec]) => {
        const delegate = prisma[spec.model];
        if (!delegate) return [key, 0];
        const where = spec.scoped ? notTrashed(req) : owned(req);
        return [key, await delegate.count({ where })];
      })
    );
    res.json({ counts: Object.fromEntries(entries) });
  })
);

// POST /api/data/import — replay an export document into this account
router.post(
  '/import',
  asyncHandler(async (req, res) => {
    const payload = req.body?.data && typeof req.body.data === 'object' ? req.body : req.body?.payload;
    if (!payload || typeof payload !== 'object' || !payload.data) {
      throw badRequest('Expected a SortLife export document with a "data" object');
    }
    if (payload.version && payload.version > EXPORT_VERSION) {
      throw badRequest('That export came from a newer version of SortLife');
    }

    const mode = req.body.mode === 'replace' ? 'replace' : 'merge';
    const imported = {};
    const skipped = [];

    for (const [key, spec] of Object.entries(COLLECTIONS)) {
      const rows = payload.data[key];
      if (!Array.isArray(rows) || !rows.length) continue;
      const delegate = prisma[spec.model];
      if (!delegate) continue;

      if (mode === 'replace') {
        await delegate.deleteMany({ where: owned(req) });
      }

      /* Only the fields this version knows about survive the trip —
         an unknown column from a future export would throw. */
      const cleaned = rows
        .map((row) => {
          const out = { userId: req.user.id };
          for (const field of spec.fields) {
            if (row[field] === undefined || row[field] === null) continue;
            if (/At$|Date$/.test(field)) {
              const d = new Date(row[field]);
              if (!Number.isNaN(d.getTime())) out[field] = d;
            } else {
              out[field] = row[field];
            }
          }
          return out;
        })
        .filter((row) => Object.keys(row).length > 1)
        .slice(0, 5000);

      if (!cleaned.length) continue;
      try {
        const result = await delegate.createMany({ data: cleaned, skipDuplicates: true });
        imported[key] = result.count;
      } catch (err) {
        // One malformed collection should not sink the whole import.
        skipped.push({ collection: key, reason: err.message });
      }
    }

    const total = Object.values(imported).reduce((a, b) => a + b, 0);
    res.json({
      message: `Imported ${total} record${total === 1 ? '' : 's'}`,
      mode,
      imported,
      skipped,
    });
  })
);

module.exports = router;
