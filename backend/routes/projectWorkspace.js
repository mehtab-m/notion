/* Developer workspace inside a project: repositories, tech stack, environments,
   services, docs, saved commands, work sessions + handoffs, activity, my-work.
   Mounted from routes/projects.js (already behind auth + developerMiddleware). */
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { serialize } = require('../utils/serialize');
const { parseDate } = require('../utils/body');
const { findAccessibleProject, findEditableProject, accessibleProjectsWhere } = require('../utils/projectAccess');
const { assertNoSecrets } = require('../utils/secretGuard');
const { logProjectActivity, taskStatus, TASK_STATUSES } = require('../utils/projectActivity');

/* ── Field specs ─────────────────────────────────────────────────────────── */
const s = (max, extra = {}) => ({ type: 'str', max, ...extra });
const e = (values, def) => ({ type: 'enum', values, def });

const RESOURCES = {
  repositories: {
    model: 'projectRepository', label: 'repository', titleKey: 'name',
    fields: {
      name: s(200, { required: true }),
      provider: e(['github', 'gitlab', 'bitbucket', 'azure_devops', 'self_hosted', 'other'], 'github'),
      remoteUrl: s(1000), purpose: e(['frontend', 'backend', 'mobile', 'infrastructure', 'docs', 'monorepo', 'other'], 'other'),
      defaultBranch: s(255), primaryLanguage: s(100), localPath: s(1000), readmeUrl: s(1000), notes: s(5000),
    },
  },
  technologies: {
    model: 'projectTechnology', label: 'technology', titleKey: 'name',
    fields: {
      name: s(100, { required: true }),
      category: e(['frontend', 'backend', 'database', 'mobile', 'infrastructure', 'styling', 'testing', 'tooling', 'other'], 'other'),
      version: s(50), notes: s(1000), repositoryId: { type: 'ref' },
    },
  },
  environments: {
    model: 'projectEnvironment', label: 'environment', titleKey: 'name',
    fields: {
      name: s(100, { required: true }),
      environmentType: e(['local', 'development', 'staging', 'production', 'custom'], 'development'),
      status: e(['active', 'inactive', 'needs_review', 'archived'], 'active'),
      machineLabel: s(100), applicationUrl: s(1000), apiUrl: s(1000), deploymentProvider: s(100),
      serverHostname: s(255), operatingSystem: s(100), deploymentBranch: s(255), deploymentMethod: s(2000),
      runtimeVersions: { type: 'object' }, variables: { type: 'array' }, notes: s(20000),
      lastReviewedAt: { type: 'date' },
    },
  },
  services: {
    model: 'projectService', label: 'service', titleKey: 'name',
    fields: {
      name: s(120, { required: true }),
      category: e(['database', 'cache', 'hosting', 'storage', 'auth', 'payments', 'email', 'monitoring', 'search', 'queue', 'analytics', 'external_api', 'dns', 'other'], 'other'),
      provider: s(120), purpose: s(500), dashboardUrl: s(1000), documentationUrl: s(1000),
      instances: { type: 'array' }, notes: s(10000),
    },
  },
  documents: {
    model: 'projectDocument', label: 'document', titleKey: 'title',
    fields: {
      title: s(300, { required: true }),
      category: e(['architecture', 'requirements', 'setup', 'api', 'database', 'deployment', 'troubleshooting', 'adr', 'notes', 'general'], 'general'),
      summary: s(500), content: s(100000), taskIds: { type: 'strArr' },
      repositoryId: { type: 'ref' }, environmentId: { type: 'ref' }, archivedAt: { type: 'date' },
    },
  },
  commands: {
    model: 'projectCommand', label: 'command', titleKey: 'title',
    fields: {
      title: s(300, { required: true }), commandText: s(10000, { required: true }), description: s(2000),
      shell: e(['powershell', 'bash', 'zsh', 'cmd', 'other'], 'bash'),
      operatingSystem: e(['windows', 'macos', 'linux', 'cross_platform'], 'cross_platform'),
      category: e(['install', 'development', 'test', 'build', 'database', 'deployment', 'maintenance', 'other'], 'other'),
      prerequisites: s(2000), isDestructive: { type: 'bool' },
      repositoryId: { type: 'ref' }, environmentId: { type: 'ref' },
    },
  },
};

/** Whitelist + coerce a body against a field spec. */
function pick(spec, body, { partial }) {
  const b = body || {};
  const out = {};
  for (const [key, f] of Object.entries(spec)) {
    if (b[key] === undefined) {
      if (!partial && f.required) throw Object.assign(new Error(`${key} is required`), { status: 400, field: key });
      continue;
    }
    const v = b[key];
    switch (f.type) {
      case 'str': {
        const str = String(v ?? '').trim().slice(0, f.max);
        if (f.required && !str) throw Object.assign(new Error(`${key} is required`), { status: 400, field: key });
        out[key] = str;
        break;
      }
      case 'enum': out[key] = f.values.includes(v) ? v : f.def; break;
      case 'bool': out[key] = Boolean(v); break;
      case 'ref': out[key] = v ? String(v) : null; break;
      case 'date': out[key] = v ? parseDate(v) ?? null : null; break;
      case 'strArr': out[key] = (Array.isArray(v) ? v : []).map(String).slice(0, 100); break;
      case 'array': out[key] = Array.isArray(v) ? JSON.parse(JSON.stringify(v)).slice(0, 200) : []; break;
      case 'object': out[key] = v && typeof v === 'object' && !Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : {}; break;
      default: break;
    }
  }
  return out;
}

function fail(res, err, fallback = 400) {
  const status = err.status || fallback;
  if (status >= 500) console.error('[project-workspace]', err);
  return res.status(status).json({ error: err.message, field: err.field });
}

/* ── Cross-project: my work + active session (must precede /:id routes) ──── */

async function sessionView(session) {
  if (!session) return null;
  const project = session.project || await prisma.project.findUnique({ where: { id: session.projectId }, select: { id: true, title: true, color: true } });
  return serialize({ ...session, project: project ? { id: project.id, title: project.title, color: project.color } : null, seconds: sessionSeconds(session) });
}

function sessionSeconds(session) {
  const now = Date.now();
  return Math.round((Array.isArray(session.segments) ? session.segments : []).reduce((sum, seg) => {
    const start = new Date(seg.start).getTime();
    const end = seg.end ? new Date(seg.end).getTime() : now;
    return sum + Math.max(0, end - start);
  }, 0) / 1000);
}

router.get('/sessions/active', async (req, res) => {
  try {
    const session = await prisma.workSession.findFirst({
      where: { userId: req.user.id, status: { in: ['active', 'paused'] } },
      orderBy: { updatedAt: 'desc' },
      include: { project: { select: { id: true, title: true, color: true } } },
    });
    res.json(await sessionView(session));
  } catch (err) { fail(res, err, 500); }
});

router.get('/workspace/my-work', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { ...accessibleProjectsWhere(req.user), archivedAt: null },
      select: { id: true, title: true, color: true, status: true, tasks: true },
    });
    const tasks = [];
    for (const p of projects) {
      for (const t of Array.isArray(p.tasks) ? p.tasks : []) {
        if (t.archivedAt) continue;
        tasks.push({ ...t, status: taskStatus(t), project: { id: p.id, title: p.title, color: p.color } });
      }
    }
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 864e5);
    const open = tasks.filter((t) => t.status !== 'done');
    const due = (t) => (t.dueAt ? new Date(t.dueAt) : null);
    const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
    const byPriority = (a, b) => (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2);

    const projectIds = projects.map((p) => p.id);
    const [activeSession, handoffs, activity] = await Promise.all([
      prisma.workSession.findFirst({
        where: { userId: req.user.id, status: { in: ['active', 'paused'] } },
        orderBy: { updatedAt: 'desc' },
        include: { project: { select: { id: true, title: true, color: true } } },
      }),
      prisma.workSession.findMany({
        where: { projectId: { in: projectIds }, status: 'completed' },
        orderBy: { endedAt: 'desc' }, take: 30,
        include: { project: { select: { id: true, title: true, color: true } } },
      }).then((rows) => rows.filter((r) => r.handoff).slice(0, 6)),
      prisma.projectActivity.findMany({
        where: { projectId: { in: projectIds } }, orderBy: { createdAt: 'desc' }, take: 25,
        include: { project: { select: { id: true, title: true } } },
      }),
    ]);

    res.json({
      counts: {
        open: open.length,
        inProgress: open.filter((t) => t.status === 'in_progress').length,
        blocked: open.filter((t) => t.status === 'blocked').length,
        review: open.filter((t) => t.status === 'review').length,
        overdue: open.filter((t) => due(t) && due(t) < now).length,
      },
      inProgress: open.filter((t) => t.status === 'in_progress').sort(byPriority),
      blocked: open.filter((t) => t.status === 'blocked'),
      review: open.filter((t) => t.status === 'review'),
      dueSoon: open.filter((t) => due(t) && due(t) <= soon).sort((a, b) => due(a) - due(b)),
      nextActions: open.filter((t) => t.nextAction && t.status !== 'blocked').sort(byPriority).slice(0, 10),
      activeSession: await sessionView(activeSession),
      handoffs: serialize(handoffs),
      activity: serialize(activity),
    });
  } catch (err) { fail(res, err, 500); }
});

/* ── Overview bundle: everything the project workspace tabs need ─────────── */
router.get('/:id/workspace', async (req, res) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const where = { projectId: project.id };
    const [repositories, technologies, environments, services, documents, commands, sessions, activity] = await Promise.all([
      prisma.projectRepository.findMany({ where, orderBy: { createdAt: 'asc' } }),
      prisma.projectTechnology.findMany({ where, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
      prisma.projectEnvironment.findMany({ where, orderBy: { createdAt: 'asc' } }),
      prisma.projectService.findMany({ where, orderBy: { createdAt: 'asc' } }),
      prisma.projectDocument.findMany({ where, orderBy: { updatedAt: 'desc' } }),
      prisma.projectCommand.findMany({ where, orderBy: [{ category: 'asc' }, { createdAt: 'asc' }] }),
      prisma.workSession.findMany({ where, orderBy: { startedAt: 'desc' }, take: 30 }),
      prisma.projectActivity.findMany({ where, orderBy: { createdAt: 'desc' }, take: 60 }),
    ]);
    res.json({
      repositories: serialize(repositories),
      technologies: serialize(technologies),
      environments: serialize(environments),
      services: serialize(services),
      documents: serialize(documents),
      commands: serialize(commands),
      sessions: serialize(sessions.map((x) => ({ ...x, seconds: sessionSeconds(x) }))),
      activity: serialize(activity),
    });
  } catch (err) { fail(res, err, 500); }
});

router.get('/:id/activity', async (req, res) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const take = Math.min(200, Number(req.query.limit) || 100);
    const rows = await prisma.projectActivity.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'desc' }, take });
    res.json(serialize(rows));
  } catch (err) { fail(res, err, 500); }
});

/* ── Work sessions ───────────────────────────────────────────────────────── */

function closeOpenSegment(segments, at = new Date()) {
  return (Array.isArray(segments) ? segments : []).map((seg) => (seg.end ? seg : { ...seg, end: at.toISOString() }));
}

/** Change a task's status inside Project.tasks JSON (used by sessions). */
async function setTaskStatus(project, taskId, status, user, extra = {}) {
  if (!taskId || !TASK_STATUSES.includes(status)) return;
  const tasks = Array.isArray(project.tasks) ? [...project.tasks] : [];
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  const from = taskStatus(task);
  Object.assign(task, extra);
  if (from === status) {
    await prisma.project.update({ where: { id: project.id }, data: { tasks } });
    return;
  }
  task.status = status;
  task.done = status === 'done';
  task.completedAt = status === 'done' ? new Date().toISOString() : null;
  if (status !== 'blocked') task.blockerDetails = '';
  const items = tasks.flatMap((t) => [t, ...(t.subtasks || [])]);
  const progress = items.length ? Math.round((items.filter((i) => i.done).length / items.length) * 100) : 0;
  await prisma.project.update({ where: { id: project.id }, data: { tasks, progress } });
  await logProjectActivity(project.id, user, status === 'done' ? 'task.completed' : 'task.status_changed',
    status === 'done' ? `Completed ${task.text}` : `Moved ${task.text} to ${status.replace('_', ' ')}`,
    { taskId, from, to: status });
}

async function ownSession(req) {
  return prisma.workSession.findFirst({ where: { id: req.params.sid, projectId: req.params.id, userId: req.user.id } });
}

router.get('/:id/sessions', async (req, res) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const where = { projectId: project.id };
    if (req.query.taskId) where.taskId = req.query.taskId;
    const rows = await prisma.workSession.findMany({ where, orderBy: { startedAt: 'desc' }, take: 100 });
    res.json(serialize(rows.map((x) => ({ ...x, seconds: sessionSeconds(x) }))));
  } catch (err) { fail(res, err, 500); }
});

router.post('/:id/sessions', async (req, res) => {
  try {
    const project = await findEditableProject(req.params.id, req.user);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const b = req.body || {};
    const tasks = Array.isArray(project.tasks) ? project.tasks : [];
    const task = b.taskId ? tasks.find((t) => t.id === b.taskId) : null;
    if (b.taskId && !task) return res.status(404).json({ error: 'Task not found' });
    const details = {
      branchName: String(b.branchName || '').trim().replace(/\s+/g, '-').slice(0, 255),
      notes: String(b.notes || '').slice(0, 10000),
    };
    assertNoSecrets(details);

    // One running session per person: pause whatever is running now.
    const now = new Date();
    const running = await prisma.workSession.findMany({ where: { userId: req.user.id, status: 'active' } });
    for (const r of running) {
      await prisma.workSession.update({ where: { id: r.id }, data: { status: 'paused', segments: closeOpenSegment(r.segments, now) } });
    }

    const session = await prisma.workSession.create({
      data: {
        userId: req.user.id,
        projectId: project.id,
        taskId: task?.id || null,
        taskTitle: task?.text || '',
        repositoryId: b.repositoryId || null,
        ...details,
        status: 'active',
        segments: [{ start: now.toISOString(), end: null }],
        startedAt: now,
      },
    });
    if (task && ['inbox', 'ready'].includes(taskStatus(task))) {
      await setTaskStatus(project, task.id, 'in_progress', req.user);
    }
    await logProjectActivity(project.id, req.user, 'session.started',
      task ? `Started working on ${task.text}` : 'Started a work session', { sessionId: session.id, taskId: task?.id });
    res.status(201).json(await sessionView(session));
  } catch (err) { fail(res, err); }
});

router.put('/:id/sessions/:sid', async (req, res) => {
  try {
    const session = await ownSession(req);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const b = req.body || {};
    const data = {};
    if (b.branchName !== undefined) data.branchName = String(b.branchName || '').trim().replace(/\s+/g, '-').slice(0, 255);
    if (b.notes !== undefined) data.notes = String(b.notes || '').slice(0, 10000);
    if (b.repositoryId !== undefined) data.repositoryId = b.repositoryId || null;
    assertNoSecrets(data);
    const saved = await prisma.workSession.update({ where: { id: session.id }, data });
    res.json(await sessionView(saved));
  } catch (err) { fail(res, err); }
});

router.post('/:id/sessions/:sid/pause', async (req, res) => {
  try {
    const session = await ownSession(req);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ error: 'Session is not running' });
    const saved = await prisma.workSession.update({
      where: { id: session.id }, data: { status: 'paused', segments: closeOpenSegment(session.segments) },
    });
    res.json(await sessionView(saved));
  } catch (err) { fail(res, err); }
});

router.post('/:id/sessions/:sid/resume', async (req, res) => {
  try {
    const session = await ownSession(req);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'paused') return res.status(400).json({ error: 'Session is not paused' });
    const now = new Date();
    const running = await prisma.workSession.findMany({ where: { userId: req.user.id, status: 'active', NOT: { id: session.id } } });
    for (const r of running) {
      await prisma.workSession.update({ where: { id: r.id }, data: { status: 'paused', segments: closeOpenSegment(r.segments, now) } });
    }
    const segments = [...closeOpenSegment(session.segments, now), { start: now.toISOString(), end: null }];
    const saved = await prisma.workSession.update({ where: { id: session.id }, data: { status: 'active', segments } });
    res.json(await sessionView(saved));
  } catch (err) { fail(res, err); }
});

/** Complete with an optional handoff; can move the task (done / review / blocked …). */
router.post('/:id/sessions/:sid/complete', async (req, res) => {
  try {
    const session = await ownSession(req);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'completed') return res.status(400).json({ error: 'Session already completed' });
    const b = req.body || {};
    const h = b.handoff || {};
    const str = (v, max) => String(v ?? '').trim().slice(0, max);
    const handoff = {
      completedSummary: str(h.completedSummary, 10000),
      currentState: str(h.currentState, 10000),
      remainingWork: str(h.remainingWork, 10000),
      nextAction: str(h.nextAction, 1000),
      blockers: str(h.blockers, 2000),
      technicalNotes: str(h.technicalNotes, 20000),
      links: (Array.isArray(h.links) ? h.links : [])
        .map((l) => ({ label: str(l.label, 120), url: str(l.url, 1000) }))
        .filter((l) => l.url).slice(0, 20),
    };
    assertNoSecrets(handoff);
    const hasHandoff = Object.entries(handoff).some(([k, v]) => (k === 'links' ? v.length : v));
    if (b.taskStatus === 'blocked' && !handoff.blockers) {
      return res.status(400).json({ error: 'Describe the blocker to mark the task blocked', field: 'blockers' });
    }
    const now = new Date();
    const saved = await prisma.workSession.update({
      where: { id: session.id },
      data: {
        status: 'completed', endedAt: now, segments: closeOpenSegment(session.segments, now),
        handoff: hasHandoff ? handoff : undefined,
      },
    });

    const project = await findEditableProject(req.params.id, req.user);
    if (project && session.taskId) {
      const extra = {};
      if (handoff.nextAction) extra.nextAction = handoff.nextAction;
      const to = TASK_STATUSES.includes(b.taskStatus) ? b.taskStatus : null;
      if (to === 'blocked') extra.blockerDetails = handoff.blockers;
      if (to) await setTaskStatus(project, session.taskId, to, req.user, extra);
      else if (Object.keys(extra).length) await setTaskStatus(project, session.taskId, taskStatus((project.tasks || []).find((t) => t.id === session.taskId)), req.user, extra);
    }
    const mins = Math.round(sessionSeconds(saved) / 60);
    await logProjectActivity(req.params.id, req.user, 'session.completed',
      `Finished ${mins} min on ${session.taskTitle || 'the project'}${hasHandoff ? ' · handoff saved' : ''}`,
      { sessionId: session.id, taskId: session.taskId, minutes: mins });
    res.json(await sessionView(saved));
  } catch (err) { fail(res, err); }
});

router.delete('/:id/sessions/:sid', async (req, res) => {
  try {
    const session = await ownSession(req);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    await prisma.workSession.delete({ where: { id: session.id } });
    res.json({ message: 'Session deleted' });
  } catch (err) { fail(res, err, 500); }
});

/* ── Generic CRUD for repositories / technologies / environments / services / documents / commands ── */

function resourceOf(req, res, next) {
  const r = RESOURCES[req.params.resource];
  if (!r) return next('route');
  req.resource = r;
  return next();
}

router.get('/:id/:resource', resourceOf, async (req, res) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const rows = await prisma[req.resource.model].findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' } });
    res.json(serialize(rows));
  } catch (err) { fail(res, err, 500); }
});

router.post('/:id/:resource', resourceOf, async (req, res) => {
  try {
    const r = req.resource;
    const project = await findEditableProject(req.params.id, req.user);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const data = pick(r.fields, req.body, { partial: false });
    assertNoSecrets(data);
    const saved = await prisma[r.model].create({ data: { ...data, projectId: project.id } });
    await logProjectActivity(project.id, req.user, `${r.label}.added`, `Added ${r.label} ${saved[r.titleKey]}`, { id: saved.id });
    res.status(201).json(serialize(saved));
  } catch (err) { fail(res, err); }
});

router.put('/:id/:resource/:itemId', resourceOf, async (req, res) => {
  try {
    const r = req.resource;
    const project = await findEditableProject(req.params.id, req.user);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const existing = await prisma[r.model].findFirst({ where: { id: req.params.itemId, projectId: project.id } });
    if (!existing) return res.status(404).json({ error: `${r.label} not found` });
    const data = pick(r.fields, req.body, { partial: true });
    assertNoSecrets(data);
    const saved = await prisma[r.model].update({ where: { id: existing.id }, data });
    const changed = Object.keys(data).filter((k) => JSON.stringify(data[k]) !== JSON.stringify(existing[k]));
    if (changed.length) {
      await logProjectActivity(project.id, req.user, `${r.label}.updated`, `Updated ${r.label} ${saved[r.titleKey]}`, { id: saved.id, changed });
    }
    res.json(serialize(saved));
  } catch (err) { fail(res, err); }
});

router.delete('/:id/:resource/:itemId', resourceOf, async (req, res) => {
  try {
    const r = req.resource;
    const project = await findEditableProject(req.params.id, req.user);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const existing = await prisma[r.model].findFirst({ where: { id: req.params.itemId, projectId: project.id } });
    if (!existing) return res.status(404).json({ error: `${r.label} not found` });
    await prisma[r.model].delete({ where: { id: existing.id } });
    await logProjectActivity(project.id, req.user, `${r.label}.removed`, `Removed ${r.label} ${existing[r.titleKey]}`, { id: existing.id });
    res.json({ message: `${r.label} deleted` });
  } catch (err) { fail(res, err, 500); }
});

module.exports = router;
