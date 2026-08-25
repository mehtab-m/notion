const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const upload = require('../middleware/upload');
const { owned } = require('../utils/scope');
const { active, notTrashed } = require('../utils/lifecycle');
const { cleanBody, num } = require('../utils/body');
const { serialize } = require('../utils/serialize');

router.get('/', async (req, res) => {
  try {
    const { notebookId, parentId, isNotebook, favorite, tag, q } = req.query;
    // `includeArchived=true` is how the Archive view asks for the rest.
    const where = req.query.includeArchived === 'true' ? notTrashed(req) : active(req);
    if (favorite === 'true') where.favorite = true;
    if (tag) where.tags = { has: tag };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (notebookId) where.notebookId = notebookId;
    if (parentId !== undefined) where.parentId = parentId === 'null' ? null : parentId;
    if (isNotebook !== undefined) where.isNotebook = isNotebook === 'true';
    const notes = await prisma.note.findMany({
      where,
      orderBy: [{ order: 'asc' }, { pinned: 'desc' }, { updatedAt: 'desc' }],
    });
    res.json(serialize(notes));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    res.json({ imageUrl: '/uploads/' + req.file.filename });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = cleanBody(req.body);
    const saved = await prisma.note.create({
      data: {
        ...body,
        blocks: body.blocks || [],
        order: body.order != null ? num(body.order, 0) : 0,
        userId: req.user.id,
      },
    });
    res.status(201).json(serialize(saved));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const note = await prisma.note.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(serialize(note));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/children', async (req, res) => {
  try {
    const parent = await prisma.note.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!parent) return res.status(404).json({ error: 'Note not found' });
    const children = await prisma.note.findMany({
      where: active(req, { parentId: req.params.id }),
      orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
    });
    res.json(serialize(children));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.note.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Note not found' });
    const updated = await prisma.note.update({
      where: { id: existing.id },
      data: cleanBody(req.body),
    });
    res.json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const note = await prisma.note.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    const now = new Date();
    if (note.isNotebook) {
      await prisma.note.updateMany({
        where: owned(req, { notebookId: note.id, deletedAt: null }),
        data: { deletedAt: now },
      });
    }
    await prisma.note.updateMany({
      where: owned(req, { parentId: note.id, deletedAt: null }),
      data: { deletedAt: now },
    });
    await prisma.note.update({
      where: { id: note.id },
      data: { deletedAt: now, archivedAt: null },
    });
    res.json({ message: 'Note moved to trash', _id: note.id, type: 'note' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
