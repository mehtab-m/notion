const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Table = require('../models/Table');
const { owned } = require('../utils/scope');

async function loadTable(req, res) {
  const table = await Table.findOne(owned(req, { _id: req.params.id }));
  if (!table) {
    res.status(404).json({ error: 'Table not found' });
    return null;
  }
  return table;
}

router.get('/', async (req, res) => {
  try {
    const tables = await Table.find(owned(req), 'name createdAt columns rows').sort({ createdAt: -1 });
    const result = tables.map((t) => ({
      _id: t._id,
      name: t.name,
      createdAt: t.createdAt,
      columnCount: t.columns.length,
      rowCount: t.rows.length,
    }));
    res.json(result);
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
    const saved = await new Table({ name, columns: cols, rows: [], userId: req.user._id }).save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const table = await Table.findOne(owned(req, { _id: req.params.id }));
    if (!table) return res.status(404).json({ error: 'Table not found' });
    res.json(table);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Table.findOneAndUpdate(
      owned(req, { _id: req.params.id }),
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Table not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Table.findOneAndDelete(owned(req, { _id: req.params.id }));
    if (!deleted) return res.status(404).json({ error: 'Table not found' });
    res.json({ message: 'Table deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/rows', async (req, res) => {
  try {
    const table = await loadTable(req, res);
    if (!table) return;
    const newRow = { id: uuidv4(), data: req.body.data || {} };
    table.rows.push(newRow);
    table.updatedAt = Date.now();
    await table.save();
    res.status(201).json(newRow);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/rows/:rowId', async (req, res) => {
  try {
    const table = await loadTable(req, res);
    if (!table) return;
    const rowIndex = table.rows.findIndex((r) => r.id === req.params.rowId);
    if (rowIndex === -1) return res.status(404).json({ error: 'Row not found' });
    table.rows[rowIndex].data = req.body.data;
    table.markModified('rows');
    table.updatedAt = Date.now();
    await table.save();
    res.json(table.rows[rowIndex]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/rows/:rowId', async (req, res) => {
  try {
    const table = await loadTable(req, res);
    if (!table) return;
    table.rows = table.rows.filter((r) => r.id !== req.params.rowId);
    table.updatedAt = Date.now();
    await table.save();
    res.json({ message: 'Row deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/columns', async (req, res) => {
  try {
    const table = await loadTable(req, res);
    if (!table) return;
    const newCol = {
      id: uuidv4(),
      name: req.body.name,
      type: req.body.type || 'text',
      options: req.body.options || [],
    };
    table.columns.push(newCol);
    table.updatedAt = Date.now();
    await table.save();
    res.status(201).json(newCol);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/columns/:colId', async (req, res) => {
  try {
    const table = await loadTable(req, res);
    if (!table) return;
    const colIndex = table.columns.findIndex((c) => c.id === req.params.colId);
    if (colIndex === -1) return res.status(404).json({ error: 'Column not found' });
    table.columns[colIndex] = { ...table.columns[colIndex].toObject(), ...req.body };
    table.markModified('columns');
    table.updatedAt = Date.now();
    await table.save();
    res.json(table.columns[colIndex]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/columns/:colId', async (req, res) => {
  try {
    const table = await loadTable(req, res);
    if (!table) return;
    table.columns = table.columns.filter((c) => c.id !== req.params.colId);
    table.rows = table.rows.map((row) => {
      const newData = { ...row.data };
      delete newData[req.params.colId];
      return { id: row.id, data: newData };
    });
    table.markModified('rows');
    table.updatedAt = Date.now();
    await table.save();
    res.json({ message: 'Column deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
