const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { cleanBody } = require('../utils/body');
const { serialize, serializeTablePart } = require('../utils/serialize');

async function loadTable(req) {
  return prisma.spreadsheet.findFirst({
    where: owned(req, { _id: req.params.id }),
  });
}

router.get('/', async (req, res) => {
  try {
    const tables = await prisma.spreadsheet.findMany({
      where: owned(req),
      select: { id: true, name: true, createdAt: true, columns: true, rows: true },
      orderBy: { createdAt: 'desc' },
    });
    const result = tables.map((t) => {
      const cols = Array.isArray(t.columns) ? t.columns : [];
      const rows = Array.isArray(t.rows) ? t.rows : [];
      return {
        _id: t.id,
        name: t.name,
        createdAt: t.createdAt,
        columnCount: cols.length,
        rowCount: rows.length,
      };
    });
    res.json(serialize(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, columns } = req.body;
    const cols = (columns || []).map((c) => ({
      id: c.id || uuidv4(),
      name: c.name,
      type: c.type || 'text',
      options: c.options || [],
    }));
    const saved = await prisma.spreadsheet.create({
      data: { name, columns: cols, rows: [], userId: req.user.id },
    });
    res.status(201).json(serialize(saved));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const table = await loadTable(req);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    res.json(serialize(table));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await loadTable(req);
    if (!existing) return res.status(404).json({ error: 'Table not found' });
    const updated = await prisma.spreadsheet.update({
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
    const existing = await loadTable(req);
    if (!existing) return res.status(404).json({ error: 'Table not found' });
    await prisma.spreadsheet.delete({ where: { id: existing.id } });
    res.json({ message: 'Table deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/rows', async (req, res) => {
  try {
    const table = await loadTable(req);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const rows = Array.isArray(table.rows) ? [...table.rows] : [];
    const newRow = { id: uuidv4(), data: req.body.data || {} };
    rows.push(newRow);
    await prisma.spreadsheet.update({
      where: { id: table.id },
      data: { rows },
    });
    res.status(201).json(serializeTablePart(newRow));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/rows/:rowId', async (req, res) => {
  try {
    const table = await loadTable(req);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const rows = Array.isArray(table.rows) ? [...table.rows] : [];
    const rowIndex = rows.findIndex((r) => r.id === req.params.rowId);
    if (rowIndex === -1) return res.status(404).json({ error: 'Row not found' });
    rows[rowIndex] = { ...rows[rowIndex], data: req.body.data };
    await prisma.spreadsheet.update({
      where: { id: table.id },
      data: { rows },
    });
    res.json(serializeTablePart(rows[rowIndex]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/rows/:rowId', async (req, res) => {
  try {
    const table = await loadTable(req);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const rows = (Array.isArray(table.rows) ? table.rows : []).filter(
      (r) => r.id !== req.params.rowId
    );
    await prisma.spreadsheet.update({
      where: { id: table.id },
      data: { rows },
    });
    res.json({ message: 'Row deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/columns', async (req, res) => {
  try {
    const table = await loadTable(req);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const columns = Array.isArray(table.columns) ? [...table.columns] : [];
    const newCol = {
      id: uuidv4(),
      name: req.body.name,
      type: req.body.type || 'text',
      options: req.body.options || [],
    };
    columns.push(newCol);
    await prisma.spreadsheet.update({
      where: { id: table.id },
      data: { columns },
    });
    res.status(201).json(serializeTablePart(newCol));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/columns/:colId', async (req, res) => {
  try {
    const table = await loadTable(req);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const columns = Array.isArray(table.columns) ? [...table.columns] : [];
    const colIndex = columns.findIndex((c) => c.id === req.params.colId);
    if (colIndex === -1) return res.status(404).json({ error: 'Column not found' });
    columns[colIndex] = { ...columns[colIndex], ...req.body };
    await prisma.spreadsheet.update({
      where: { id: table.id },
      data: { columns },
    });
    res.json(serializeTablePart(columns[colIndex]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/columns/:colId', async (req, res) => {
  try {
    const table = await loadTable(req);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const columns = (Array.isArray(table.columns) ? table.columns : []).filter(
      (c) => c.id !== req.params.colId
    );
    const rows = (Array.isArray(table.rows) ? table.rows : []).map((row) => {
      const newData = { ...(row.data || {}) };
      delete newData[req.params.colId];
      return { id: row.id, data: newData };
    });
    await prisma.spreadsheet.update({
      where: { id: table.id },
      data: { columns, rows },
    });
    res.json({ message: 'Column deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
