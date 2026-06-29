const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Project = require('../models/Project');

function calcProgress(tasks) {
  const items = [];
  (tasks || []).forEach((t) => {
    items.push(t);
    (t.subtasks || []).forEach((s) => items.push(s));
  });
  if (!items.length) return 0;
  const done = items.filter((i) => i.done).length;
  return Math.round((done / items.length) * 100);
}

// GET all projects
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create project
router.post('/', async (req, res) => {
  try {
    const project = new Project(req.body);
    const saved = await project.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET single project
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update project
router.put('/:id', async (req, res) => {
  try {
    const updated = await Project.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Project not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE project
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Project.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Team ─────────────────────────────────────────────────
router.post('/:id/team', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!project.team) project.team = [];
    if (!project.team.includes(name)) project.team.push(name);
    project.updatedAt = Date.now();
    project.markModified('team');
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/team/:name', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    project.team = (project.team || []).filter((m) => m !== decodeURIComponent(req.params.name));
    project.updatedAt = Date.now();
    project.markModified('team');
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Tasks ────────────────────────────────────────────────
router.post('/:id/tasks', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Task text is required' });
    const task = {
      id: uuidv4(),
      text,
      done: false,
      assignee: req.body.assignee || '',
      subtasks: [],
    };
    project.tasks.push(task);
    project.progress = calcProgress(project.tasks);
    project.updatedAt = Date.now();
    project.markModified('tasks');
    await project.save();
    res.status(201).json(project);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/tasks/:taskId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const task = project.tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (req.body.text !== undefined) task.text = req.body.text;
    if (req.body.assignee !== undefined) task.assignee = req.body.assignee;
    if (req.body.done !== undefined) task.done = req.body.done;
    project.progress = calcProgress(project.tasks);
    project.updatedAt = Date.now();
    project.markModified('tasks');
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/tasks/:taskId/toggle', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const task = project.tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    task.done = !task.done;
    project.progress = calcProgress(project.tasks);
    project.updatedAt = Date.now();
    project.markModified('tasks');
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/tasks/:taskId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    project.tasks = project.tasks.filter((t) => t.id !== req.params.taskId);
    project.progress = calcProgress(project.tasks);
    project.updatedAt = Date.now();
    project.markModified('tasks');
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Subtasks ─────────────────────────────────────────────
router.post('/:id/tasks/:taskId/subtasks', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const task = project.tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Subtask text is required' });
    if (!task.subtasks) task.subtasks = [];
    task.subtasks.push({
      id: uuidv4(),
      text,
      done: false,
      assignee: req.body.assignee || '',
    });
    project.progress = calcProgress(project.tasks);
    project.updatedAt = Date.now();
    project.markModified('tasks');
    await project.save();
    res.status(201).json(project);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/tasks/:taskId/subtasks/:subId/toggle', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const task = project.tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const sub = (task.subtasks || []).find((s) => s.id === req.params.subId);
    if (!sub) return res.status(404).json({ error: 'Subtask not found' });
    sub.done = !sub.done;
    project.progress = calcProgress(project.tasks);
    project.updatedAt = Date.now();
    project.markModified('tasks');
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/tasks/:taskId/subtasks/:subId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const task = project.tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const sub = (task.subtasks || []).find((s) => s.id === req.params.subId);
    if (!sub) return res.status(404).json({ error: 'Subtask not found' });
    if (req.body.text !== undefined) sub.text = req.body.text;
    if (req.body.assignee !== undefined) sub.assignee = req.body.assignee;
    if (req.body.done !== undefined) sub.done = req.body.done;
    project.progress = calcProgress(project.tasks);
    project.updatedAt = Date.now();
    project.markModified('tasks');
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/tasks/:taskId/subtasks/:subId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const task = project.tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    task.subtasks = (task.subtasks || []).filter((s) => s.id !== req.params.subId);
    project.progress = calcProgress(project.tasks);
    project.updatedAt = Date.now();
    project.markModified('tasks');
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Data tables (full dynamic tables, same as main Tables) ─
function getProjectTable(project, tableId) {
  const table = (project.dataTables || []).find((t) => t.id === tableId);
  if (!table) return null;
  if (!table.columns) table.columns = [];
  if (!table.rows) table.rows = [];
  // Migrate legacy key-value rows
  if (table.rows.length > 0 && table.rows[0].key !== undefined && table.rows[0].data === undefined) {
    if (table.columns.length === 0) {
      const keyCol = { id: uuidv4(), name: 'Key', type: 'text', options: [] };
      const valCol = { id: uuidv4(), name: 'Value', type: 'text', options: [] };
      table.columns = [keyCol, valCol];
    }
    const keyColId = table.columns[0]?.id;
    const valColId = table.columns[1]?.id || table.columns[0]?.id;
    table.rows = table.rows.map((r) => ({
      id: r.id,
      data: { [keyColId]: r.key || '', [valColId]: r.value || '' },
    }));
  }
  return table;
}

router.post('/:id/tables', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Table name is required' });
    const cols = (req.body.columns || []).map((c) => ({
      id: c.id || uuidv4(),
      name: c.name,
      type: c.type || 'text',
      options: c.options || [],
    }));
    if (!project.dataTables) project.dataTables = [];
    project.dataTables.push({ id: uuidv4(), name, columns: cols, rows: [] });
    project.updatedAt = Date.now();
    project.markModified('dataTables');
    await project.save();
    res.status(201).json(project);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/tables/:tableId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const table = getProjectTable(project, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    if (req.body.name) table.name = req.body.name.trim();
    project.updatedAt = Date.now();
    project.markModified('dataTables');
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/tables/:tableId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    project.dataTables = (project.dataTables || []).filter((t) => t.id !== req.params.tableId);
    project.updatedAt = Date.now();
    project.markModified('dataTables');
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/tables/:tableId/rows', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const table = getProjectTable(project, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const newRow = { id: uuidv4(), data: req.body.data || {} };
    table.rows.push(newRow);
    project.updatedAt = Date.now();
    project.markModified('dataTables');
    await project.save();
    res.status(201).json(newRow);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/tables/:tableId/rows/:rowId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const table = getProjectTable(project, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const row = table.rows.find((r) => r.id === req.params.rowId);
    if (!row) return res.status(404).json({ error: 'Row not found' });
    row.data = req.body.data;
    project.updatedAt = Date.now();
    project.markModified('dataTables');
    await project.save();
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/tables/:tableId/rows/:rowId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const table = getProjectTable(project, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    table.rows = table.rows.filter((r) => r.id !== req.params.rowId);
    project.updatedAt = Date.now();
    project.markModified('dataTables');
    await project.save();
    res.json({ message: 'Row deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/tables/:tableId/columns', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const table = getProjectTable(project, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const newCol = {
      id: uuidv4(),
      name: req.body.name,
      type: req.body.type || 'text',
      options: req.body.options || [],
    };
    table.columns.push(newCol);
    project.updatedAt = Date.now();
    project.markModified('dataTables');
    await project.save();
    res.status(201).json(newCol);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/tables/:tableId/columns/:colId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const table = getProjectTable(project, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const colIndex = table.columns.findIndex((c) => c.id === req.params.colId);
    if (colIndex === -1) return res.status(404).json({ error: 'Column not found' });
    table.columns[colIndex] = { ...table.columns[colIndex], ...req.body };
    project.updatedAt = Date.now();
    project.markModified('dataTables');
    await project.save();
    res.json(table.columns[colIndex]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/tables/:tableId/columns/:colId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const table = getProjectTable(project, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    table.columns = table.columns.filter((c) => c.id !== req.params.colId);
    table.rows = table.rows.map((row) => {
      const newData = { ...(row.data || {}) };
      delete newData[req.params.colId];
      return { id: row.id, data: newData };
    });
    project.updatedAt = Date.now();
    project.markModified('dataTables');
    await project.save();
    res.json({ message: 'Column deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
