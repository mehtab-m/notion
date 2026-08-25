const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const upload = require('../middleware/upload');
const { owned } = require('../utils/scope');
const { active, notTrashed } = require('../utils/lifecycle');
const { cleanBody, num } = require('../utils/body');
const { serialize } = require('../utils/serialize');
const { resolveImageField } = require('../utils/mediaUrl');

function showData(body, file) {
  const data = cleanBody(body);
  const image = resolveImageField(data, file, {
    fileField: 'posterImage',
    urlFields: ['posterImageUrl', 'posterImage'],
  });
  if (!image.ok) {
    const err = new Error(image.error);
    err.status = 400;
    throw err;
  }
  if (image.value !== undefined) data.posterImage = image.value;
  delete data.posterImageUrl;

  if (data.currentSeason != null) data.currentSeason = num(data.currentSeason, 1);
  if (data.currentEpisode != null) data.currentEpisode = num(data.currentEpisode, 0);
  if (data.totalSeasons != null) data.totalSeasons = num(data.totalSeasons, 1);
  if (data.rating != null) data.rating = num(data.rating, 0);
  if (data.mediaType != null) {
    data.mediaType = data.mediaType === 'movie' ? 'movie' : 'series';
    if (data.mediaType === 'movie') {
      data.currentSeason = 1;
      data.currentEpisode = data.currentEpisode || 0;
      data.totalSeasons = 1;
    }
  }
  return data;
}

router.get('/', async (req, res) => {
  try {
    const shows = await prisma.show.findMany({
      where: active(req),
      orderBy: { createdAt: 'desc' },
    });
    res.json(serialize(shows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', upload.single('posterImage'), async (req, res) => {
  try {
    const saved = await prisma.show.create({
      data: { ...showData(req.body, req.file), userId: req.user.id },
    });
    res.status(201).json(serialize(saved));
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const show = await prisma.show.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!show) return res.status(404).json({ error: 'Show not found' });
    res.json(serialize(show));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', upload.single('posterImage'), async (req, res) => {
  try {
    const existing = await prisma.show.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Show not found' });
    const updated = await prisma.show.update({
      where: { id: existing.id },
      data: showData(req.body, req.file),
    });
    res.json(serialize(updated));
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.show.findFirst({
      where: notTrashed(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Show not found' });
    await prisma.show.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), archivedAt: null },
    });
    res.json({ message: 'Show moved to trash', _id: existing.id, type: 'show' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
