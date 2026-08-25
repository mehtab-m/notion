/* ─── Archive, Trash & Favorites ───────────────────────────
   One router for the three verbs every content type shares.
   Without it each of the seven models would grow its own
   near-identical archive/restore/purge/star endpoints.     */

const express = require('express');
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { serialize } = require('../utils/serialize');
const { asyncHandler, badRequest, notFoundError } = require('../middleware/errors');
const {
  LIFECYCLE_MODELS,
  TRASH_TTL_DAYS,
  archivedOnly,
  trashedOnly,
  notTrashed,
  purgeCutoff,
} = require('../utils/lifecycle');

const router = express.Router();

/** Resolve a `:type` path param to its Prisma delegate, or 400. */
function resolveType(type) {
  const entry = LIFECYCLE_MODELS[type];
  if (!entry) {
    throw badRequest(
      `Unknown type "${type}". Expected one of: ${Object.keys(LIFECYCLE_MODELS).join(', ')}`
    );
  }
  const delegate = prisma[entry.model];
  if (!delegate) throw badRequest(`Type "${type}" is not available`);
  return { ...entry, delegate, type };
}

/** Shape a row into the compact card the Archive/Trash lists render. */
function toEntry(row, entry) {
  const raw = row[entry.titleField];
  const title = String(raw || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    _id: row.id,
    type: entry.type,
    label: entry.label,
    title: title.slice(0, 120) || `Untitled ${entry.label.toLowerCase()}`,
    favorite: row.favorite === true,
    archivedAt: row.archivedAt || null,
    deletedAt: row.deletedAt || null,
    createdAt: row.createdAt || null,
  };
}

/** Fetch one bucket across every lifecycle model, newest first. */
async function collect(req, scopeFn, sortKey) {
  const buckets = await Promise.all(
    Object.entries(LIFECYCLE_MODELS).map(async ([type, meta]) => {
      const delegate = prisma[meta.model];
      if (!delegate) return [];
      const rows = await delegate.findMany({
        where: scopeFn(req),
        select: {
          id: true,
          [meta.titleField]: true,
          favorite: true,
          archivedAt: true,
          deletedAt: true,
          createdAt: true,
        },
        orderBy: { [sortKey]: 'desc' },
        take: 200,
      });
      return rows.map((row) => toEntry(row, { ...meta, type }));
    })
  );
  return buckets
    .flat()
    .sort((a, b) => new Date(b[sortKey] || 0) - new Date(a[sortKey] || 0));
}

// GET /api/lifecycle/archive — everything the user shelved
router.get(
  '/archive',
  asyncHandler(async (req, res) => {
    const items = await collect(req, archivedOnly, 'archivedAt');
    res.json(serialize({ items, total: items.length }));
  })
);

// GET /api/lifecycle/trash — everything awaiting purge
router.get(
  '/trash',
  asyncHandler(async (req, res) => {
    const items = await collect(req, trashedOnly, 'deletedAt');
    res.json(
      serialize({
        items,
        total: items.length,
        retentionDays: TRASH_TTL_DAYS,
      })
    );
  })
);

// GET /api/lifecycle/favorites — starred across every type
router.get(
  '/favorites',
  asyncHandler(async (req, res) => {
    const buckets = await Promise.all(
      Object.entries(LIFECYCLE_MODELS).map(async ([type, meta]) => {
        const delegate = prisma[meta.model];
        if (!delegate) return [];
        const rows = await delegate.findMany({
          where: notTrashed(req, { favorite: true, archivedAt: null }),
          select: {
            id: true,
            [meta.titleField]: true,
            favorite: true,
            archivedAt: true,
            deletedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        return rows.map((row) => toEntry(row, { ...meta, type }));
      })
    );
    const items = buckets.flat();
    res.json(serialize({ items, total: items.length }));
  })
);

/** Load a row the caller owns and that is not already purged. */
async function loadOwned(req, entry, { allowTrashed = false } = {}) {
  const where = allowTrashed
    ? owned(req, { _id: req.params.id })
    : notTrashed(req, { _id: req.params.id });
  const row = await entry.delegate.findFirst({ where, select: { id: true } });
  if (!row) throw notFoundError(`${entry.label} not found`);
  return row;
}

// POST /api/lifecycle/:type/:id/archive — shelve without deleting
router.post(
  '/:type/:id/archive',
  asyncHandler(async (req, res) => {
    const entry = resolveType(req.params.type);
    const row = await loadOwned(req, entry);
    const updated = await entry.delegate.update({
      where: { id: row.id },
      data: { archivedAt: new Date() },
    });
    res.json(serialize({ ...toEntry(updated, entry), message: `${entry.label} archived` }));
  })
);

// POST /api/lifecycle/:type/:id/unarchive — back to the active list
router.post(
  '/:type/:id/unarchive',
  asyncHandler(async (req, res) => {
    const entry = resolveType(req.params.type);
    const row = await loadOwned(req, entry);
    const updated = await entry.delegate.update({
      where: { id: row.id },
      data: { archivedAt: null },
    });
    res.json(serialize({ ...toEntry(updated, entry), message: `${entry.label} restored` }));
  })
);

// POST /api/lifecycle/:type/:id/restore — pull back out of the trash
router.post(
  '/:type/:id/restore',
  asyncHandler(async (req, res) => {
    const entry = resolveType(req.params.type);
    const row = await loadOwned(req, entry, { allowTrashed: true });
    const updated = await entry.delegate.update({
      where: { id: row.id },
      data: { deletedAt: null, archivedAt: null },
    });

    /* A trashed notebook took its pages down with it — bring them back
       together, otherwise the notebook returns empty. */
    if (entry.type === 'note') {
      await prisma.note.updateMany({
        where: owned(req, { OR: [{ notebookId: row.id }, { parentId: row.id }] }),
        data: { deletedAt: null },
      });
    }
    if (entry.type === 'book') {
      const book = await prisma.book.findFirst({
        where: owned(req, { _id: row.id }),
        select: { notebookId: true },
      });
      if (book?.notebookId) {
        await prisma.note.updateMany({
          where: owned(req, {
            OR: [{ id: book.notebookId }, { notebookId: book.notebookId }],
          }),
          data: { deletedAt: null },
        });
      }
    }

    res.json(serialize({ ...toEntry(updated, entry), message: `${entry.label} restored` }));
  })
);

// DELETE /api/lifecycle/:type/:id — permanent, no second chance
router.delete(
  '/:type/:id',
  asyncHandler(async (req, res) => {
    const entry = resolveType(req.params.type);
    const row = await loadOwned(req, entry, { allowTrashed: true });
    await entry.delegate.delete({ where: { id: row.id } });
    res.json({ message: `${entry.label} permanently deleted`, _id: row.id, type: entry.type });
  })
);

// POST /api/lifecycle/:type/:id/favorite — toggle the star
router.post(
  '/:type/:id/favorite',
  asyncHandler(async (req, res) => {
    const entry = resolveType(req.params.type);
    const current = await entry.delegate.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
      select: { id: true, favorite: true },
    });
    if (!current) throw notFoundError(`${entry.label} not found`);

    // An explicit `favorite` in the body wins; otherwise flip it.
    const next =
      typeof req.body?.favorite === 'boolean' ? req.body.favorite : !current.favorite;
    const updated = await entry.delegate.update({
      where: { id: current.id },
      data: { favorite: next },
    });
    res.json(serialize(toEntry(updated, entry)));
  })
);

// POST /api/lifecycle/trash/empty — purge the whole trash now
router.post(
  '/trash/empty',
  asyncHandler(async (req, res) => {
    let removed = 0;
    for (const meta of Object.values(LIFECYCLE_MODELS)) {
      const delegate = prisma[meta.model];
      if (!delegate) continue;
      const result = await delegate.deleteMany({ where: trashedOnly(req) });
      removed += result.count;
    }
    res.json({ message: `${removed} item${removed === 1 ? '' : 's'} permanently deleted`, removed });
  })
);

// POST /api/lifecycle/trash/purge-expired — drop anything past the TTL
router.post(
  '/trash/purge-expired',
  asyncHandler(async (req, res) => {
    const cutoff = purgeCutoff();
    let removed = 0;
    for (const meta of Object.values(LIFECYCLE_MODELS)) {
      const delegate = prisma[meta.model];
      if (!delegate) continue;
      const result = await delegate.deleteMany({
        where: owned(req, { deletedAt: { lt: cutoff } }),
      });
      removed += result.count;
    }
    res.json({ message: `Purged ${removed} expired item(s)`, removed, cutoff });
  })
);

module.exports = router;
