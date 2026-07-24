const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const upload = require('../middleware/upload');
const { owned } = require('../utils/scope');
const { cleanBody, num } = require('../utils/body');
const { serialize } = require('../utils/serialize');

function isExternalUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function showData(body, file) {
  const data = cleanBody(body);
  // Prefer uploaded file; otherwise accept posterImage / posterImageUrl string
  if (file) {
    data.posterImage = '/uploads/' + file.filename;
  } else {
    const urlCandidate = (data.posterImageUrl || data.posterImage || '').trim();
    if (urlCandidate) {
      data.posterImage = isExternalUrl(urlCandidate)
        ? urlCandidate
        : urlCandidate.startsWith('/uploads/')
          ? urlCandidate
          : urlCandidate;
    }
    delete data.posterImageUrl;
  }
  if (data.currentSeason != null) data.currentSeason = num(data.currentSeason, 1);
  if (data.currentEpisode != null) data.currentEpisode = num(data.currentEpisode, 0);
  if (data.totalSeasons != null) data.totalSeasons = num(data.totalSeasons, 1);
  if (data.rating != null) data.rating = num(data.rating, 0);
  return data;
}

router.get('/', async (req, res) => {
  try {
    const shows = await prisma.show.findMany({
      where: owned(req),
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
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const show = await prisma.show.findFirst({
      where: owned(req, { _id: req.params.id }),
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
      where: owned(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Show not found' });
    const updated = await prisma.show.update({
      where: { id: existing.id },
      data: showData(req.body, req.file),
    });
    res.json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.show.findFirst({
      where: owned(req, { _id: req.params.id }),
    });
    if (!existing) return res.status(404).json({ error: 'Show not found' });
    await prisma.show.delete({ where: { id: existing.id } });
    res.json({ message: 'Show deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
