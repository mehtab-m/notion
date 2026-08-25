/* ─── Quick-capture inbox ──────────────────────────────────
   A single place to dump a thought before deciding whether it
   is a note, a goal, a habit or nothing at all. Items are
   promoted into real records via /:id/convert.             */

const express = require('express');
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { serialize } = require('../utils/serialize');
const { asyncHandler, badRequest, notFoundError } = require('../middleware/errors');

const router = express.Router();

const STATUSES = ['open', 'done', 'archived'];
const PRIORITIES = ['low', 'medium', 'high'];
const MAX_TEXT = 500;
const MAX_NOTE = 4000;

/** Where a captured item can be promoted to, and how to build it. */
const CONVERTERS = {
  note: (item, userId) => ({
    model: 'note',
    data: {
      title: item.text.slice(0, 200),
      content: item.note || '',
      blocks: item.note ? [{ type: 'text', content: item.note, order: 0 }] : [],
      folder: 'Inbox',
      tags: item.tags || [],
      userId,
    },
    url: (id) => `/notes?note=${id}`,
  }),
  goal: (item, userId) => ({
    model: 'goal',
    data: {
      title: item.text.slice(0, 200),
      description: item.note || '',
      category: 'personal',
      horizon: 'season',
      targetDate: item.dueDate || null,
      userId,
    },
    url: (id) => `/goals?goal=${id}`,
  }),
  habit: (item, userId) => ({
    model: 'habit',
    data: {
      name: item.text.slice(0, 120),
      description: item.note || '',
      frequency: 'daily',
      userId,
    },
    url: (id) => `/habits?habit=${id}`,
  }),
  sticky: (item, userId) => ({
    model: 'stickyNote',
    data: {
      content: [item.text, item.note].filter(Boolean).join('\n\n'),
      color: 'yellow',
      userId,
    },
    url: () => '/stickynotes',
  }),
};

/** Normalise and validate whatever the client sent. */
function itemData(body, { partial = false } = {}) {
  const data = {};

  if (body.text !== undefined) {
    const text = String(body.text || '').trim();
    if (!text) throw badRequest('Text is required');
    if (text.length > MAX_TEXT) throw badRequest(`Text must be under ${MAX_TEXT} characters`);
    data.text = text;
  } else if (!partial) {
    throw badRequest('Text is required');
  }

  if (body.note !== undefined) data.note = String(body.note || '').slice(0, MAX_NOTE);
  if (body.pinned !== undefined) data.pinned = body.pinned === true || body.pinned === 'true';

  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) throw badRequest('Invalid priority');
    data.priority = body.priority;
  }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw badRequest('Invalid status');
    data.status = body.status;
    // `completedAt` is what the analytics page counts, so keep it in step.
    data.completedAt = body.status === 'done' ? new Date() : null;
  }

  if (body.tags !== undefined) {
    data.tags = (Array.isArray(body.tags) ? body.tags : String(body.tags).split(','))
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12);
  }

  if (body.dueDate !== undefined) {
    if (!body.dueDate) {
      data.dueDate = null;
    } else {
      const due = new Date(body.dueDate);
      if (Number.isNaN(due.getTime())) throw badRequest('Invalid due date');
      data.dueDate = due;
    }
  }

  return data;
}

// GET /api/inbox?status=open&tag=x&q=…
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, tag, q } = req.query;
    const where = owned(req);
    if (status && status !== 'all') {
      if (!STATUSES.includes(status)) throw badRequest('Invalid status filter');
      where.status = status;
    }
    if (tag) where.tags = { has: String(tag).toLowerCase() };
    if (q) {
      where.OR = [
        { text: { contains: q, mode: 'insensitive' } },
        { note: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.inboxItem.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    });

    const counts = await prisma.inboxItem.groupBy({
      by: ['status'],
      where: owned(req),
      _count: { _all: true },
    });

    res.json(
      serialize({
        items,
        counts: Object.fromEntries(
          STATUSES.map((s) => [s, counts.find((c) => c.status === s)?._count._all || 0])
        ),
      })
    );
  })
);

// POST /api/inbox
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const saved = await prisma.inboxItem.create({
      data: { ...itemData(req.body || {}), userId: req.user.id },
    });
    res.status(201).json(serialize(saved));
  })
);

// PUT /api/inbox/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.inboxItem.findFirst({
      where: owned(req, { _id: req.params.id }),
      select: { id: true },
    });
    if (!existing) throw notFoundError('Inbox item not found');
    const updated = await prisma.inboxItem.update({
      where: { id: existing.id },
      data: itemData(req.body || {}, { partial: true }),
    });
    res.json(serialize(updated));
  })
);

// POST /api/inbox/:id/toggle — open ⇄ done
router.post(
  '/:id/toggle',
  asyncHandler(async (req, res) => {
    const existing = await prisma.inboxItem.findFirst({
      where: owned(req, { _id: req.params.id }),
      select: { id: true, status: true },
    });
    if (!existing) throw notFoundError('Inbox item not found');
    const done = existing.status !== 'done';
    const updated = await prisma.inboxItem.update({
      where: { id: existing.id },
      data: { status: done ? 'done' : 'open', completedAt: done ? new Date() : null },
    });
    res.json(serialize(updated));
  })
);

// POST /api/inbox/:id/convert — promote into a real record
router.post(
  '/:id/convert',
  asyncHandler(async (req, res) => {
    const target = String(req.body?.target || '');
    const build = CONVERTERS[target];
    if (!build) {
      throw badRequest(
        `Cannot convert to "${target}". Expected one of: ${Object.keys(CONVERTERS).join(', ')}`
      );
    }

    const item = await prisma.inboxItem.findFirst({
      where: owned(req, { _id: req.params.id }),
    });
    if (!item) throw notFoundError('Inbox item not found');
    if (item.convertedId) throw badRequest('This item was already converted');

    const spec = build(item, req.user.id);
    const created = await prisma[spec.model].create({ data: spec.data });

    const updated = await prisma.inboxItem.update({
      where: { id: item.id },
      data: {
        status: 'done',
        completedAt: new Date(),
        convertedTo: target,
        convertedId: created.id,
      },
    });

    res.status(201).json(
      serialize({
        item: updated,
        created,
        url: spec.url(created.id),
        message: `Converted to ${target}`,
      })
    );
  })
);

// DELETE /api/inbox/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.inboxItem.findFirst({
      where: owned(req, { _id: req.params.id }),
      select: { id: true },
    });
    if (!existing) throw notFoundError('Inbox item not found');
    await prisma.inboxItem.delete({ where: { id: existing.id } });
    res.json({ message: 'Inbox item deleted', _id: existing.id });
  })
);

// POST /api/inbox/clear-done — sweep everything already handled
router.post(
  '/clear-done',
  asyncHandler(async (req, res) => {
    const { count } = await prisma.inboxItem.deleteMany({
      where: owned(req, { status: 'done' }),
    });
    res.json({ message: `Cleared ${count} completed item(s)`, removed: count });
  })
);

module.exports = router;
