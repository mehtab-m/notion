const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { cleanBody } = require('../utils/body');
const { serialize } = require('../utils/serialize');

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

async function loadProject(req, id) {
  return prisma.project.findFirst({ where: owned(req, { _id: id }) });
}

async function saveProject(project, data) {
  const updated = await prisma.project.update({
    where: { id: project.id },
    data,
  });
  return updated;
}

function getTasks(project) {
  return Array.isArray(project.tasks) ? [...project.tasks] : [];
}

function getDataTables(project) {
  return Array.isArray(project.dataTables) ? [...project.dataTables] : [];
}

function getProjectTable(project, tableId) {
  const tables = getDataTables(project);
  const table = tables.find((t) => t.id === tableId);
  if (!table) return null;
  if (!table.columns) table.columns = [];
  if (!table.rows) table.rows = [];
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

router.get('/', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: owned(req),
      orderBy: { createdAt: 'desc' },
    });
    res.json(serialize(projects));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = cleanBody(req.body);
    const saved = await prisma.project.create({
      data: {
        ...body,
        tasks: body.tasks || [],
        dataTables: body.dataTables || [],
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
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(serialize(project));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await loadProject(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const updated = await saveProject(existing, cleanBody(req.body));
    res.json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await loadProject(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    await prisma.project.delete({ where: { id: existing.id } });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/team', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const team = [...(project.team || [])];
    if (!team.includes(name)) team.push(name);
    const updated = await saveProject(project, { team });
    res.json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/team/:name', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const team = (project.team || []).filter((m) => m !== decodeURIComponent(req.params.name));
    const updated = await saveProject(project, { team });
    res.json(serialize(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/tasks', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Task text is required' });
    const tasks = getTasks(project);
    tasks.push({
      id: uuidv4(),
      text,
      done: false,
      assignee: req.body.assignee || '',
      subtasks: [],
    });
    const updated = await saveProject(project, { tasks, progress: calcProgress(tasks) });
    res.status(201).json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/tasks/:taskId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = getTasks(project);
    const task = tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (req.body.text !== undefined) task.text = req.body.text;
    if (req.body.assignee !== undefined) task.assignee = req.body.assignee;
    if (req.body.done !== undefined) task.done = req.body.done;
    const updated = await saveProject(project, { tasks, progress: calcProgress(tasks) });
    res.json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/tasks/:taskId/toggle', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = getTasks(project);
    const task = tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    task.done = !task.done;
    const updated = await saveProject(project, { tasks, progress: calcProgress(tasks) });
    res.json(serialize(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/tasks/:taskId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = getTasks(project).filter((t) => t.id !== req.params.taskId);
    const updated = await saveProject(project, { tasks, progress: calcProgress(tasks) });
    res.json(serialize(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/tasks/:taskId/subtasks', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = getTasks(project);
    const task = tasks.find((t) => t.id === req.params.taskId);
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
    const updated = await saveProject(project, { tasks, progress: calcProgress(tasks) });
    res.status(201).json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/tasks/:taskId/subtasks/:subId/toggle', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = getTasks(project);
    const task = tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const sub = (task.subtasks || []).find((s) => s.id === req.params.subId);
    if (!sub) return res.status(404).json({ error: 'Subtask not found' });
    sub.done = !sub.done;
    const updated = await saveProject(project, { tasks, progress: calcProgress(tasks) });
    res.json(serialize(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/tasks/:taskId/subtasks/:subId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = getTasks(project);
    const task = tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const sub = (task.subtasks || []).find((s) => s.id === req.params.subId);
    if (!sub) return res.status(404).json({ error: 'Subtask not found' });
    if (req.body.text !== undefined) sub.text = req.body.text;
    if (req.body.assignee !== undefined) sub.assignee = req.body.assignee;
    if (req.body.done !== undefined) sub.done = req.body.done;
    const updated = await saveProject(project, { tasks, progress: calcProgress(tasks) });
    res.json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/tasks/:taskId/subtasks/:subId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = getTasks(project);
    const task = tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    task.subtasks = (task.subtasks || []).filter((s) => s.id !== req.params.subId);
    const updated = await saveProject(project, { tasks, progress: calcProgress(tasks) });
    res.json(serialize(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/tables', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Table name is required' });
    const cols = (req.body.columns || []).map((c) => ({
      id: c.id || uuidv4(),
      name: c.name,
      type: c.type || 'text',
      options: c.options || [],
    }));
    const dataTables = getDataTables(project);
    dataTables.push({ id: uuidv4(), name, columns: cols, rows: [] });
    const updated = await saveProject(project, { dataTables });
    res.status(201).json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/tables/:tableId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project);
    const table = getProjectTable({ dataTables }, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    if (req.body.name) table.name = req.body.name.trim();
    const updated = await saveProject(project, { dataTables });
    res.json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/tables/:tableId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project).filter((t) => t.id !== req.params.tableId);
    const updated = await saveProject(project, { dataTables });
    res.json(serialize(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/tables/:tableId/rows', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project);
    const table = getProjectTable({ dataTables }, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const newRow = { id: uuidv4(), data: req.body.data || {} };
    table.rows.push(newRow);
    await saveProject(project, { dataTables });
    res.status(201).json(serialize(newRow));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/tables/:tableId/rows/:rowId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project);
    const table = getProjectTable({ dataTables }, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const row = table.rows.find((r) => r.id === req.params.rowId);
    if (!row) return res.status(404).json({ error: 'Row not found' });
    row.data = req.body.data;
    await saveProject(project, { dataTables });
    res.json(serialize(row));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/tables/:tableId/rows/:rowId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project);
    const table = getProjectTable({ dataTables }, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    table.rows = table.rows.filter((r) => r.id !== req.params.rowId);
    await saveProject(project, { dataTables });
    res.json({ message: 'Row deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/tables/:tableId/columns', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project);
    const table = getProjectTable({ dataTables }, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const newCol = {
      id: uuidv4(),
      name: req.body.name,
      type: req.body.type || 'text',
      options: req.body.options || [],
    };
    table.columns.push(newCol);
    await saveProject(project, { dataTables });
    res.status(201).json(serialize(newCol));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/tables/:tableId/columns/:colId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project);
    const table = getProjectTable({ dataTables }, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const colIndex = table.columns.findIndex((c) => c.id === req.params.colId);
    if (colIndex === -1) return res.status(404).json({ error: 'Column not found' });
    table.columns[colIndex] = { ...table.columns[colIndex], ...req.body };
    await saveProject(project, { dataTables });
    res.json(serialize(table.columns[colIndex]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/tables/:tableId/columns/:colId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project);
    const table = getProjectTable({ dataTables }, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    table.columns = table.columns.filter((c) => c.id !== req.params.colId);
    table.rows = table.rows.map((row) => {
      const newData = { ...(row.data || {}) };
      delete newData[req.params.colId];
      return { id: row.id, data: newData };
    });
    await saveProject(project, { dataTables });
    res.json({ message: 'Column deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
