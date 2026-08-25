const express = require('express');
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { notTrashed } = require('../utils/lifecycle');
const { accessibleProjectsWhere } = require('../utils/projectAccess');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

/* Per-type cap so one noisy collection cannot crowd out the rest. */
const PER_TYPE = 6;

const like = (q) => ({ contains: q, mode: 'insensitive' });

/** Strip block/HTML markup so note snippets read as prose. */
function snippet(text, q, len = 140) {
  if (!text) return '';
  const plain = String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return '';
  const at = plain.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return plain.slice(0, len) + (plain.length > len ? '…' : '');
  const from = Math.max(0, at - 40);
  return (from > 0 ? '…' : '') + plain.slice(from, from + len) + (from + len < plain.length ? '…' : '');
}

// GET /api/search?q=...
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();

    // One-character queries match nearly everything and cost a full scan.
    if (q.length < 2) return res.json({ query: q, total: 0, results: [] });

    const scope = owned(req);
    // Archived rows stay findable — trashed ones do not.
    const live = notTrashed(req);
    const isDeveloper = req.user?.isDeveloper === true;

    const [notes, books, shows, tables, habits, goals, stickies, projects, friends, inbox] =
      await Promise.all([
        prisma.note.findMany({
          where: { ...live, OR: [{ title: like(q) }, { content: like(q) }] },
          select: { id: true, title: true, content: true, folder: true, isNotebook: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: PER_TYPE,
        }),
        prisma.book.findMany({
          where: { ...live, OR: [{ title: like(q) }, { author: like(q) }, { genre: like(q) }] },
          select: { id: true, title: true, author: true, status: true, coverImage: true },
          take: PER_TYPE,
        }),
        prisma.show.findMany({
          where: { ...live, OR: [{ title: like(q) }, { platform: like(q) }, { genre: like(q) }] },
          select: { id: true, title: true, platform: true, status: true, posterImage: true },
          take: PER_TYPE,
        }),
        prisma.spreadsheet.findMany({
          where: { ...live, name: like(q) },
          select: { id: true, name: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: PER_TYPE,
        }),
        prisma.habit.findMany({
          where: { ...live, OR: [{ name: like(q) }, { description: like(q) }] },
          select: { id: true, name: true, description: true, icon: true, streak: true },
          take: PER_TYPE,
        }),
        prisma.goal.findMany({
          where: { ...live, OR: [{ title: like(q) }, { description: like(q) }, { why: like(q) }] },
          select: { id: true, title: true, description: true, icon: true, progress: true, status: true },
          take: PER_TYPE,
        }),
        prisma.stickyNote.findMany({
          where: { ...live, content: like(q) },
          select: { id: true, content: true, color: true },
          take: PER_TYPE,
        }),
        isDeveloper
          ? prisma.project.findMany({
              where: {
                AND: [
                  accessibleProjectsWhere(req.user),
                  { OR: [{ title: like(q) }, { description: like(q) }] },
                ],
              },
              select: { id: true, title: true, description: true, status: true, progress: true },
              take: PER_TYPE,
            })
          : Promise.resolve([]),
        prisma.moneyFriend.findMany({
          where: { ...scope, OR: [{ name: like(q) }, { email: like(q) }] },
          select: { id: true, name: true, email: true },
          take: PER_TYPE,
        }),
        prisma.inboxItem.findMany({
          where: { ...scope, status: 'open', OR: [{ text: like(q) }, { note: like(q) }] },
          select: { id: true, text: true, note: true, priority: true },
          orderBy: { createdAt: 'desc' },
          take: PER_TYPE,
        }),
      ]);

    const results = [
      ...notes.map((n) => ({
        _id: n.id,
        type: n.isNotebook ? 'notebook' : 'note',
        title: n.title || 'Untitled note',
        subtitle: snippet(n.content, q) || n.folder,
        url: `/notes?note=${n.id}`,
      })),
      ...projects.map((p) => ({
        _id: p.id,
        type: 'project',
        title: p.title,
        subtitle: snippet(p.description, q) || `${p.progress}% · ${p.status}`,
        url: `/projects/${p.id}`,
      })),
      ...goals.map((g) => ({
        _id: g.id,
        type: 'goal',
        title: `${g.icon || '🎯'} ${g.title}`,
        subtitle: snippet(g.description, q) || `${g.progress}% · ${g.status}`,
        url: `/goals?goal=${g.id}`,
      })),
      ...habits.map((h) => ({
        _id: h.id,
        type: 'habit',
        title: `${h.icon || '✅'} ${h.name}`,
        subtitle: snippet(h.description, q) || `${h.streak} day streak`,
        url: `/habits?habit=${h.id}`,
      })),
      ...books.map((b) => ({
        _id: b.id,
        type: 'book',
        title: b.title,
        subtitle: b.author ? `by ${b.author}` : b.status,
        image: b.coverImage,
        url: `/books?book=${b.id}`,
      })),
      ...shows.map((s) => ({
        _id: s.id,
        type: 'show',
        title: s.title,
        subtitle: s.platform || s.status,
        image: s.posterImage,
        url: `/shows?show=${s.id}`,
      })),
      ...tables.map((t) => ({
        _id: t.id,
        type: 'table',
        title: t.name,
        subtitle: 'Table',
        url: `/tables/${t.id}`,
      })),
      ...stickies.map((s) => ({
        _id: s.id,
        type: 'sticky',
        title: snippet(s.content, q, 60) || 'Sticky note',
        subtitle: 'Sticky note',
        url: `/stickynotes?sticky=${s.id}`,
      })),
      ...friends.map((f) => ({
        _id: f.id,
        type: 'money',
        title: f.name,
        subtitle: f.email || 'Money ledger',
        url: `/money?friend=${f.id}`,
      })),
      ...inbox.map((i) => ({
        _id: i.id,
        type: 'inbox',
        title: i.text,
        subtitle: snippet(i.note, q) || 'Inbox',
        url: `/inbox?item=${i.id}`,
      })),
    ];

    /* Rank exact and prefix matches above mid-string hits so typing
       a full title puts it first regardless of collection order. */
    const lowered = q.toLowerCase();
    const rank = (r) => {
      const t = r.title.toLowerCase();
      if (t === lowered) return 0;
      if (t.startsWith(lowered)) return 1;
      if (t.includes(lowered)) return 2;
      return 3;
    };
    results.sort((a, b) => rank(a) - rank(b));

    res.json({ query: q, total: results.length, results: results.slice(0, 30) });
  })
);

module.exports = router;
