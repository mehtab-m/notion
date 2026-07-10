const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const upload = require('../middleware/upload');
const { owned } = require('../utils/scope');
const { cleanBody, num } = require('../utils/body');
const { serialize } = require('../utils/serialize');

router.get('/', async (req, res) => {
  try {
    const { notebookId, parentId, isNotebook } = req.query;
    const where = owned(req);
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
      where: owned(req, { _id: req.params.id }),
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
      where: owned(req, { _id: req.params.id }),
    });
    if (!parent) return res.status(404).json({ error: 'Note not found' });
    const children = await prisma.note.findMany({
      where: owned(req, { parentId: req.params.id }),
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
      where: owned(req, { _id: req.params.id }),
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
      where: owned(req, { _id: req.params.id }),
    });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (note.isNotebook) {
      await prisma.note.deleteMany({ where: owned(req, { notebookId: note.id }) });
    }
    await prisma.note.deleteMany({ where: owned(req, { parentId: note.id }) });
    await prisma.note.delete({ where: { id: note.id } });
    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
