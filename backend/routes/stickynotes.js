const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { active, notTrashed } = require('../utils/lifecycle');
const { cleanBody } = require('../utils/body');
const { serialize } = require('../utils/serialize');

const ALLOWED_STICKY_COLORS = ['yellow', 'purple', 'green'];

function stickyData(body) {
  const data = cleanBody(body);
  if (data.color != null && !ALLOWED_STICKY_COLORS.includes(data.color)) {
    data.color = 'yellow';
  }
  return data;
}

router.get('/', async (req, res) => {
  try {
    const notes = await prisma.stickyNote.findMany({
      where: active(req),
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
      data: { ...stickyData(req.body), userId: req.user.id },
    });
    res.status(201).json(serialize(saved));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.stickyNote.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Sticky note not found' });
    const updated = await prisma.stickyNote.update({
      where: { id: existing.id },
      data: stickyData(req.body),
    });
    res.json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.stickyNote.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Sticky note not found' });
    await prisma.stickyNote.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), archivedAt: null },
    });
    res.json({ message: 'Sticky note moved to trash', _id: existing.id, type: 'sticky' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
