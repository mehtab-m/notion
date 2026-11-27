const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { cleanBody, parseDate } = require('../utils/body');
const { serialize, serializeTablePart } = require('../utils/serialize');
const { findAccessibleProject, findEditableProject, findOwnedProject, acceptedAssignees, accessibleProjectsWhere } = require('../utils/projectAccess');
const { sendProjectInviteEmail } = require('../utils/email');
const { developerMiddleware } = require('../middleware/auth');
const { logProjectActivity, TASK_STATUSES, TASK_PRIORITIES, taskStatus } = require('../utils/projectActivity');
const { assertNoSecrets } = require('../utils/secretGuard');

router.use(developerMiddleware);

/* Workflow fields a task may carry beyond text/done/assignee/subtasks. */
function applyTaskFields(task, body, user, projectId, log) {
  const b = body || {};
  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  if (b.text !== undefined) task.text = str(b.text, 300) || task.text;
  if (b.assignee !== undefined) task.assignee = b.assignee || '';
  if (b.description !== undefined) task.description = str(b.description, 50000);
  if (b.nextAction !== undefined) task.nextAction = str(b.nextAction, 1000);
  if (b.priority !== undefined) {
    const p = TASK_PRIORITIES.includes(b.priority) ? b.priority : 'medium';
    if (p !== (task.priority || 'medium')) log.push(['task.priority_changed', `Changed priority of ${task.text} to ${p}`, { from: task.priority || 'medium', to: p }]);
    task.priority = p;
  }
  if (b.dueAt !== undefined) task.dueAt = b.dueAt ? (parseDate(b.dueAt)?.toISOString() ?? null) : null;
  if (b.repositoryId !== undefined) task.repositoryId = b.repositoryId || null;
  if (b.externalUrl !== undefined) task.externalUrl = str(b.externalUrl, 1000);
  if (b.labels !== undefined) {
    task.labels = (Array.isArray(b.labels) ? b.labels : String(b.labels).split(','))
      .map((l) => str(l, 40)).filter(Boolean).slice(0, 12);
  }
  if (b.links !== undefined) {
    task.links = (Array.isArray(b.links) ? b.links : [])
      .map((l) => ({ id: l.id || uuidv4(), label: str(l.label, 120), url: str(l.url, 1000) }))
      .filter((l) => l.url).slice(0, 20);
  }
  if (b.archived !== undefined) task.archivedAt = b.archived ? new Date().toISOString() : null;

  // Status and done stay in sync: done ⇔ status 'done'.
  let next;
  if (b.status !== undefined && TASK_STATUSES.includes(b.status)) next = b.status;
  else if (b.done !== undefined) next = b.done ? 'done' : (taskStatus(task) === 'done' ? 'ready' : taskStatus(task));
  if (b.blockerDetails !== undefined) task.blockerDetails = str(b.blockerDetails, 2000);
  if (next) {
    const from = taskStatus(task);
    if (next === 'blocked' && !String(task.blockerDetails || '').trim()) {
      const err = new Error('Describe what is blocking this task');
      err.field = 'blockerDetails';
      throw err;
    }
    task.status = next;
    task.done = next === 'done';
    if (next === 'done' && from !== 'done') task.completedAt = new Date().toISOString();
    if (next !== 'done') task.completedAt = null;
    if (next !== 'blocked') task.blockerDetails = '';
    if (from !== next) {
      if (next === 'done') log.push(['task.completed', `Completed ${task.text}`, { from }]);
      else if (from === 'done') log.push(['task.reopened', `Reopened ${task.text}`, { to: next }]);
      else log.push(['task.status_changed', `Moved ${task.text} to ${next.replace('_', ' ')}`, { from, to: next }]);
    }
  }
  if (!task.status) task.status = taskStatus(task);
  if (!task.priority) task.priority = 'medium';
  return task;
}

async function flushTaskLog(projectId, user, taskId, log) {
  for (const [type, summary, meta] of log) {
    await logProjectActivity(projectId, user, type, summary, { taskId, ...meta });
  }
}

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

async function loadProject(req, id, { requireEdit = false } = {}) {
  const finder = requireEdit ? findEditableProject : findAccessibleProject;
  return finder(id, req.user);
}

async function saveProject(project, data, user) {
  const patch = { ...data };
  if (patch.dataTables != null) patch.dataTables = JSON.parse(JSON.stringify(patch.dataTables));
  if (patch.tasks != null) patch.tasks = JSON.parse(JSON.stringify(patch.tasks));
  await prisma.project.update({ where: { id: project.id }, data: patch });
  return findAccessibleProject(project.id, user);
}

function replyProject(res, project, userId, status = 200) {
  return res.status(status).json(projectPayload(project, userId));
}

function projectPayload(project, viewerId) {
  const team = acceptedAssignees(project);
  return serialize({
    ...project,
    team,
    members: project.members || [],
    isOwner: project.userId === viewerId,
  });
}

function getTasks(project) {
  return Array.isArray(project.tasks) ? [...project.tasks] : [];
}

function getDataTables(project) {
  return Array.isArray(project.dataTables) ? [...project.dataTables] : [];
}

function matchColId(col, id) {
  return col.id === id || col._id === id;
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

router.get('/invitations/pending', async (req, res) => {
  try {
    const invites = await prisma.projectMember.findMany({
      where: { email: req.user.email, status: 'pending' },
      include: { project: { select: { id: true, title: true, userId: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(serialize(invites));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/invitations/:memberId/accept', async (req, res) => {
  try {
    const member = await prisma.projectMember.findFirst({
      where: { id: req.params.memberId, email: req.user.email, status: 'pending' },
      include: { project: true },
    });
    if (!member) return res.status(404).json({ error: 'Invitation not found' });
    await prisma.projectMember.update({
      where: { id: member.id },
      data: { status: 'accepted', userId: req.user.id, name: req.user.name, acceptedAt: new Date() },
    });
    const team = [...new Set([...(member.project.team || []), req.user.name])];
    await prisma.project.update({ where: { id: member.projectId }, data: { team } });
    const project = await findAccessibleProject(member.projectId, req.user);
    res.json(projectPayload(project, req.user.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/invitations/:memberId/decline', async (req, res) => {
  try {
    const member = await prisma.projectMember.findFirst({
      where: { id: req.params.memberId, email: req.user.email, status: 'pending' },
    });
    if (!member) return res.status(404).json({ error: 'Invitation not found' });
    await prisma.projectMember.update({
      where: { id: member.id },
      data: { status: 'declined' },
    });
    res.json({ message: 'Invitation declined' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: accessibleProjectsWhere(req.user),
      include: { members: true, user: { select: { id: true, name: true, email: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(projects.map((p) => projectPayload(p, req.user.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const ACCOUNT_TYPES = ['company', 'personal', 'freelance', 'client', 'study', 'open-source'];
const PROJECT_TYPES = ['software', 'design', 'marketing', 'research', 'content', 'operations', 'event', 'other'];
const STATUSES = ['active', 'planned', 'on-hold', 'maintenance', 'completed', 'archived'];
const PRIORITIES = ['low', 'medium', 'high'];

/* Whitelist what a client may set on a project. The old handler spread the
   raw body into Prisma, so a plain "2026-12-01" from <input type="date">
   (not a full ISO DateTime) or any unknown key made create fail. */
function projectFields(body, { partial = false } = {}) {
  const b = body || {};
  const data = {};
  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  if (b.title !== undefined || !partial) {
    const title = str(b.title, 200);
    if (!title) throw new Error('Project name is required');
    data.title = title;
  }
  if (b.description !== undefined) data.description = str(b.description, 5000);
  if (b.status !== undefined) data.status = STATUSES.includes(b.status) ? b.status : 'active';
  if (b.priority !== undefined) data.priority = PRIORITIES.includes(b.priority) ? b.priority : 'medium';
  if (b.accountType !== undefined) data.accountType = ACCOUNT_TYPES.includes(b.accountType) ? b.accountType : 'personal';
  if (b.projectType !== undefined) data.projectType = PROJECT_TYPES.includes(b.projectType) ? b.projectType : 'other';
  if (b.organization !== undefined) data.organization = str(b.organization, 160);
  if (b.role !== undefined) data.role = str(b.role, 120);
  if (b.color !== undefined) data.color = str(b.color, 32);
  if (b.dueDate !== undefined) data.dueDate = parseDate(b.dueDate) ?? null;
  if (b.startDate !== undefined) data.startDate = parseDate(b.startDate) ?? null;
  if (b.budget !== undefined) {
    const n = b.budget === '' || b.budget == null ? null : Number(b.budget);
    data.budget = Number.isFinite(n) ? n : null;
  }
  if (b.tags !== undefined) {
    data.tags = (Array.isArray(b.tags) ? b.tags : String(b.tags).split(','))
      .map((t) => String(t).trim()).filter(Boolean).slice(0, 20);
  }
  if (b.projectUrl !== undefined) data.projectUrl = str(b.projectUrl, 1000);
  if (b.documentationUrl !== undefined) data.documentationUrl = str(b.documentationUrl, 1000);
  if (b.notes !== undefined) data.notes = str(b.notes, 5000);
  if (data.status) data.archivedAt = data.status === 'archived' ? new Date() : null;
  return data;
}

const PROJECT_EDITABLE = [
  'title', 'description', 'status', 'priority', 'accountType', 'projectType', 'organization', 'role',
  'color', 'dueDate', 'startDate', 'budget', 'tags', 'projectUrl', 'documentationUrl', 'notes',
];

/* Turn Prisma's long internal errors into one sentence a person can act on. */
function friendlyError(err) {
  const msg = String(err?.message || '');
  if (err?.code === 'P2022' || /column .* does not exist/i.test(msg)) {
    return 'The database is missing new project fields. Run "npm run db:push" in backend/ and restart the server.';
  }
  if (/Unknown arg(ument)?/i.test(msg)) {
    return 'The server is running an old database client. Restart the backend (npm run dev) and try again.';
  }
  if (err?.code === 'P2003') return 'Your account was not found. Please log out and log in again.';
  if (/Invalid .*invocation/i.test(msg)) return 'Some project details could not be saved. Check the dates and budget and try again.';
  return msg || 'Could not create the project';
}

router.post('/', async (req, res) => {
  try {
    const data = projectFields(req.body);
    if (data.startDate && data.dueDate && data.dueDate < data.startDate) {
      return res.status(400).json({ error: 'The end date is before the start date.', field: 'dueDate' });
    }
    if (data.budget != null && data.budget < 0) {
      return res.status(400).json({ error: 'Budget cannot be negative.', field: 'budget' });
    }
    const saved = await prisma.project.create({
      data: {
        ...data,
        tasks: Array.isArray(req.body?.tasks) ? req.body.tasks : [],
        dataTables: Array.isArray(req.body?.dataTables) ? req.body.dataTables : [],
        userId: req.user.id,
      },
    });
    await logProjectActivity(saved.id, req.user, 'project.created', `Created project ${saved.title}`);
    res.status(201).json(serialize(saved));
  } catch (err) {
    console.error('[projects:create]', err);
    const field = /name is required/i.test(err.message) ? 'title' : undefined;
    res.status(400).json({ error: friendlyError(err), field });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(projectPayload(project, req.user.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await loadProject(req, req.params.id, { requireEdit: true });
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const patch = cleanBody(req.body, [
      'members', 'user', 'isOwner', 'messages', 'emailDelivered', 'archivedAt',
      'repositories', 'technologies', 'environments', 'services', 'documents', 'commands', 'workSessions', 'activities',
    ]);
    const known = {};
    for (const key of PROJECT_EDITABLE) {
      if (key in patch) { known[key] = patch[key]; delete patch[key]; }
    }
    Object.assign(patch, projectFields(known, { partial: true }));
    assertNoSecrets({ projectUrl: patch.projectUrl, documentationUrl: patch.documentationUrl, notes: patch.notes });
    const full = await saveProject(existing, patch, req.user);

    const changed = PROJECT_EDITABLE.filter((k) => k in patch
      && JSON.stringify(patch[k] instanceof Date ? patch[k].toISOString() : patch[k])
        !== JSON.stringify(existing[k] instanceof Date ? existing[k].toISOString() : existing[k]));
    if (changed.length) {
      const statusMove = changed.includes('status') ? ` (${existing.status} → ${patch.status})` : '';
      await logProjectActivity(existing.id, req.user,
        patch.status === 'archived' && existing.status !== 'archived' ? 'project.archived' : 'project.updated',
        `Updated ${changed.join(', ')}${statusMove}`, { changed });
    }
    replyProject(res, full, req.user.id);
  } catch (err) {
    res.status(400).json({ error: err.message, field: err.field });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await findOwnedProject(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    await prisma.project.delete({ where: { id: existing.id } });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/invite', async (req, res) => {
  try {
    const project = await findOwnedProject(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (email === req.user.email) return res.status(400).json({ error: 'You are already on this project' });

    const invitee = await prisma.user.findUnique({ where: { email } });
    if (!invitee?.isVerified) {
      return res.status(400).json({ error: 'User must be a registered SortLife member with a verified email' });
    }

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_email: { projectId: project.id, email } },
    });
    if (existing?.status === 'accepted') {
      return res.status(400).json({ error: 'This member is already on the project' });
    }
    if (existing?.status === 'pending') {
      return res.status(400).json({ error: 'Invitation already sent' });
    }

    const member = await prisma.projectMember.upsert({
      where: { projectId_email: { projectId: project.id, email } },
      create: {
        projectId: project.id,
        email,
        name: invitee.name,
        userId: invitee.id,
        status: 'pending',
        invitedBy: req.user.name,
      },
      update: {
        status: 'pending',
        name: invitee.name,
        userId: invitee.id,
        invitedBy: req.user.name,
        acceptedAt: null,
      },
    });

    const emailResult = await sendProjectInviteEmail(email, req.user.name, project.title, project.id);
    const full = await findOwnedProject(project.id, req.user.id);
    res.status(201).json({ ...projectPayload(full, req.user.id), emailDelivered: emailResult.sent });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    const project = await findOwnedProject(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const member = await prisma.projectMember.findFirst({
      where: { id: req.params.memberId, projectId: project.id },
    });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    await prisma.projectMember.delete({ where: { id: member.id } });
    if (member.status === 'accepted' && member.name) {
      const team = (project.team || []).filter((n) => n !== member.name);
      await prisma.project.update({ where: { id: project.id }, data: { team } });
    }
    const full = await findOwnedProject(project.id, req.user.id);
    res.json(projectPayload(full, req.user.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const where = { projectId: project.id };
    if (req.query.taskId) where.taskId = req.query.taskId;
    else where.taskId = null;
    const messages = await prisma.projectMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    res.json(serialize(messages));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/messages', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Message is required' });
    const saved = await prisma.projectMessage.create({
      data: {
        projectId: project.id,
        taskId: req.body.taskId || null,
        userId: req.user.id,
        userName: req.user.name,
        text,
      },
    });
    res.status(201).json(serialize(saved));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/team/:name', async (req, res) => {
  try {
    const project = await findOwnedProject(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const team = (project.team || []).filter((m) => m !== decodeURIComponent(req.params.name));
    const full = await saveProject(project, { team }, req.user);
    replyProject(res, full, req.user.id);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/tasks', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Task text is required' });
    const tasks = getTasks(project);
    const task = {
      id: uuidv4(),
      text,
      done: false,
      assignee: req.body.assignee || '',
      subtasks: [],
      status: 'ready',
      priority: 'medium',
      createdAt: new Date().toISOString(),
    };
    const { text: _t, done: _d, ...rest } = req.body || {};
    if (!rest.status) rest.status = req.body.done ? 'done' : 'ready';
    applyTaskFields(task, rest, req.user, project.id, []);
    tasks.push(task);
    const full = await saveProject(project, { tasks, progress: calcProgress(tasks) }, req.user);
    await logProjectActivity(project.id, req.user, 'task.created', `Created task ${task.text}`, { taskId: task.id, status: task.status, priority: task.priority });
    replyProject(res, full, req.user.id, 201);
  } catch (err) {
    res.status(400).json({ error: err.message, field: err.field });
  }
});

/* Board drag-and-drop: move a task to a status and/or position. */
router.post('/:id/tasks/:taskId/move', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = getTasks(project);
    const idx = tasks.findIndex((t) => t.id === req.params.taskId);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });
    const [task] = tasks.splice(idx, 1);
    const log = [];
    applyTaskFields(task, { status: req.body.status, blockerDetails: req.body.blockerDetails }, req.user, project.id, log);
    const beforeId = req.body.beforeId;
    const at = beforeId ? tasks.findIndex((t) => t.id === beforeId) : -1;
    if (at >= 0) tasks.splice(at, 0, task); else tasks.push(task);
    const full = await saveProject(project, { tasks, progress: calcProgress(tasks) }, req.user);
    await flushTaskLog(project.id, req.user, task.id, log);
    replyProject(res, full, req.user.id);
  } catch (err) {
    res.status(400).json({ error: err.message, field: err.field });
  }
});

router.put('/:id/tasks/:taskId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = getTasks(project);
    const task = tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const log = [];
    const before = JSON.stringify(task);
    applyTaskFields(task, req.body, req.user, project.id, log);
    const full = await saveProject(project, { tasks, progress: calcProgress(tasks) }, req.user);
    if (!log.length && before !== JSON.stringify(task)) log.push(['task.updated', `Updated ${task.text}`, {}]);
    await flushTaskLog(project.id, req.user, task.id, log);
    replyProject(res, full, req.user.id);
  } catch (err) {
    res.status(400).json({ error: err.message, field: err.field });
  }
});

router.post('/:id/tasks/:taskId/toggle', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = getTasks(project);
    const task = tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const log = [];
    applyTaskFields(task, { done: !task.done }, req.user, project.id, log);
    const full = await saveProject(project, { tasks, progress: calcProgress(tasks) }, req.user);
    await flushTaskLog(project.id, req.user, task.id, log);
    replyProject(res, full, req.user.id);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/tasks/:taskId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const gone = getTasks(project).find((t) => t.id === req.params.taskId);
    const tasks = getTasks(project).filter((t) => t.id !== req.params.taskId);
    const full = await saveProject(project, { tasks, progress: calcProgress(tasks) }, req.user);
    if (gone) await logProjectActivity(project.id, req.user, 'task.deleted', `Deleted task ${gone.text}`, { taskId: gone.id });
    replyProject(res, full, req.user.id);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/tasks/:taskId/subtasks', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
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
    const full = await saveProject(project, { tasks, progress: calcProgress(tasks) }, req.user);
    replyProject(res, full, req.user.id, 201);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/tasks/:taskId/subtasks/:subId/toggle', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = getTasks(project);
    const task = tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const sub = (task.subtasks || []).find((s) => s.id === req.params.subId);
    if (!sub) return res.status(404).json({ error: 'Subtask not found' });
    sub.done = !sub.done;
    const full = await saveProject(project, { tasks, progress: calcProgress(tasks) }, req.user);
    replyProject(res, full, req.user.id);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/tasks/:taskId/subtasks/:subId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = getTasks(project);
    const task = tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const sub = (task.subtasks || []).find((s) => s.id === req.params.subId);
    if (!sub) return res.status(404).json({ error: 'Subtask not found' });
    if (req.body.text !== undefined) sub.text = req.body.text;
    if (req.body.assignee !== undefined) sub.assignee = req.body.assignee;
    if (req.body.done !== undefined) sub.done = req.body.done;
    const full = await saveProject(project, { tasks, progress: calcProgress(tasks) }, req.user);
    replyProject(res, full, req.user.id);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/tasks/:taskId/subtasks/:subId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = getTasks(project);
    const task = tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    task.subtasks = (task.subtasks || []).filter((s) => s.id !== req.params.subId);
    const full = await saveProject(project, { tasks, progress: calcProgress(tasks) }, req.user);
    replyProject(res, full, req.user.id);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/tables', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
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
    const full = await saveProject(project, { dataTables }, req.user);
    replyProject(res, full, req.user.id, 201);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/tables/:tableId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project);
    const table = getProjectTable({ dataTables }, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    if (req.body.name) table.name = req.body.name.trim();
    const full = await saveProject(project, { dataTables }, req.user);
    replyProject(res, full, req.user.id);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/tables/:tableId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project).filter((t) => t.id !== req.params.tableId);
    const full = await saveProject(project, { dataTables }, req.user);
    replyProject(res, full, req.user.id);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/tables/:tableId/rows', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project);
    const table = getProjectTable({ dataTables }, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const newRow = { id: uuidv4(), data: req.body.data || {} };
    table.rows.push(newRow);
    await saveProject(project, { dataTables }, req.user);
    res.status(201).json(serializeTablePart(newRow));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/tables/:tableId/rows/:rowId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project);
    const table = getProjectTable({ dataTables }, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const row = table.rows.find((r) => r.id === req.params.rowId);
    if (!row) return res.status(404).json({ error: 'Row not found' });
    row.data = req.body.data;
    await saveProject(project, { dataTables }, req.user);
    res.json(serializeTablePart(row));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/tables/:tableId/rows/:rowId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project);
    const table = getProjectTable({ dataTables }, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    table.rows = table.rows.filter((r) => r.id !== req.params.rowId);
    await saveProject(project, { dataTables }, req.user);
    res.json({ message: 'Row deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/tables/:tableId/columns', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
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
    await saveProject(project, { dataTables }, req.user);
    res.status(201).json(serializeTablePart(newCol));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/tables/:tableId/columns/:colId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project);
    const table = getProjectTable({ dataTables }, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const colIndex = table.columns.findIndex((c) => matchColId(c, req.params.colId));
    if (colIndex === -1) return res.status(404).json({ error: 'Column not found' });
    table.columns[colIndex] = { ...table.columns[colIndex], ...req.body };
    await saveProject(project, { dataTables }, req.user);
    res.json(serializeTablePart(table.columns[colIndex]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/tables/:tableId/columns/:colId', async (req, res) => {
  try {
    const project = await loadProject(req, req.params.id, { requireEdit: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const dataTables = getDataTables(project);
    const table = getProjectTable({ dataTables }, req.params.tableId);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    table.columns = table.columns.filter((c) => !matchColId(c, req.params.colId));
    table.rows = table.rows.map((row) => {
      const newData = { ...(row.data || {}) };
      delete newData[req.params.colId];
      return { id: row.id, data: newData };
    });
    await saveProject(project, { dataTables }, req.user);
    res.json({ message: 'Column deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Developer workspace: repositories, stack, environments, services, docs, commands, sessions, activity.
router.use(require('./projectWorkspace'));

module.exports = router;
