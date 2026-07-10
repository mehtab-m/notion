const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { cleanBody } = require('../utils/body');
const { serialize } = require('../utils/serialize');

router.get('/', async (req, res) => {
  try {
    const notes = await prisma.stickyNote.findMany({
      where: owned(req),
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(serialize(notes));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const saved = await prisma.stickyNote.create({
      data: { ...cleanBody(req.body), userId: req.user.id },
    });
    res.status(201).json(serialize(saved));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.stickyNote.findFirst({
      where: owned(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Sticky note not found' });
    const updated = await prisma.stickyNote.update({
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
    const existing = await prisma.stickyNote.findFirst({
      where: owned(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Sticky note not found' });
    await prisma.stickyNote.delete({ where: { id: existing.id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
