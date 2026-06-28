const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Table = require('../models/Table');

// GET all tables (name + createdAt only)
router.get('/', async (req, res) => {
  try {
    const tables = await Table.find({}, 'name createdAt columns rows').sort({ createdAt: -1 });
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

// POST create new table
router.post('/', async (req, res) => {
  try {
    const { name, columns } = req.body;
    const cols = (columns || []).map((c) => ({
      id: c.id || uuidv4(),
      name: c.name,
      type: c.type || 'text',
      options: c.options || [],
    }));
    const table = new Table({ name, columns: cols, rows: [] });
    const saved = await table.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET full table
router.get('/:id', async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    res.json(table);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update table name or columns
router.put('/:id', async (req, res) => {
  try {
    const updated = await Table.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Table not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE table
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Table.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Table not found' });
    res.json({ message: 'Table deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add row
router.post('/:id/rows', async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const newRow = { id: uuidv4(), data: req.body.data || {} };
    table.rows.push(newRow);
    table.updatedAt = Date.now();
    await table.save();
    res.status(201).json(newRow);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update row
router.put('/:id/rows/:rowId', async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Table not found' });
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

// DELETE row
router.delete('/:id/rows/:rowId', async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    table.rows = table.rows.filter((r) => r.id !== req.params.rowId);
    table.updatedAt = Date.now();
    await table.save();
    res.json({ message: 'Row deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add column
router.post('/:id/columns', async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Table not found' });
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

// PUT update column
router.put('/:id/columns/:colId', async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Table not found' });
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

// DELETE column (and remove its data from all rows)
router.delete('/:id/columns/:colId', async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ error: 'Table not found' });
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
