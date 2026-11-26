/* ─── Notifications service ────────────────────────────────
   1. buildFeed(user, { hour })  → in-app alerts, derived live from
      the user's data and filtered by their preferences.
   2. buildWeeklySummary(userId) → numbers for the Monday email.
   3. startNotificationScheduler() → hourly tick that sends the
      weekly digest once per week to everyone who opted in.     */

const prisma = require('../lib/prisma');
const { sendEmail } = require('../utils/email');
const { pickKnown, inQuietHours } = require('../utils/notifications');

const DAY = 24 * 60 * 60 * 1000;

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const notTrashed = (userId) => ({ userId, deletedAt: null, archivedAt: null });

/**
 * Every alert has a stable id (type + record + date) so "mark as read"
 * survives refreshes and the same alert is not shown twice.
 */
async function buildFeed(user, { hour = new Date().getHours() } = {}) {
  const prefs = pickKnown(user.notificationPrefs || {});
  const quiet = inQuietHours(prefs, hour);
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + DAY);
  const todayKey = dayKey(today);
  const items = [];

  const [inbox, goals, habits] = await Promise.all([
    prefs.deadlineAlerts
      ? prisma.inboxItem.findMany({
          where: { userId: user.id, status: 'open', dueDate: { not: null, lt: tomorrow } },
          select: { id: true, text: true, dueDate: true, priority: true },
          orderBy: { dueDate: 'asc' },
          take: 30,
        })
      : [],
    prefs.deadlineAlerts
      ? prisma.goal.findMany({
          where: { ...notTrashed(user.id), status: { notIn: ['completed', 'abandoned'] } },
          select: { id: true, title: true, icon: true, targetDate: true, milestones: true, followUps: true },
        })
      : [],
    prefs.habitReminders
      ? prisma.habit.findMany({
          where: notTrashed(user.id),
          select: { id: true, name: true, icon: true, completedDates: true, streak: true },
        })
      : [],
  ]);

  for (const i of inbox) {
    const overdue = new Date(i.dueDate) < today;
    items.push({
      id: `inbox:${i.id}:${dayKey(i.dueDate)}`,
      type: overdue ? 'overdue' : 'due',
      title: overdue ? 'Overdue in your inbox' : 'Due today',
      body: i.text,
      url: `/inbox?item=${i.id}`,
      at: i.dueDate,
      priority: overdue || i.priority === 'high' ? 'high' : 'normal',
    });
  }

  for (const g of goals) {
    const followUps = Array.isArray(g.followUps) ? g.followUps : [];
    for (const f of followUps) {
      if (f.done || !f.dueDate) continue;
      const due = new Date(f.dueDate);
      if (Number.isNaN(due.getTime()) || due >= tomorrow) continue;
      const overdue = due < today;
      items.push({
        id: `follow:${g.id}:${f.id}`,
        type: overdue ? 'overdue' : 'due',
        title: `${g.icon || '🎯'} ${g.title} — follow-up ${overdue ? 'overdue' : 'due today'}`,
        body: f.text,
        url: `/goals?goal=${g.id}`,
        at: f.dueDate,
        priority: overdue ? 'high' : 'normal',
      });
    }
    const milestones = Array.isArray(g.milestones) ? g.milestones : [];
    for (const m of milestones) {
      if (m.done || !m.dueDate) continue;
      const due = new Date(m.dueDate);
      if (Number.isNaN(due.getTime()) || due >= tomorrow) continue;
      items.push({
        id: `ms:${g.id}:${m.id}`,
        type: due < today ? 'overdue' : 'due',
        title: `${g.icon || '🎯'} Sub-goal ${due < today ? 'overdue' : 'due today'}`,
        body: `${m.text} · ${g.title}`,
        url: `/goals?goal=${g.id}`,
        at: m.dueDate,
        priority: due < today ? 'high' : 'normal',
      });
    }
    if (g.targetDate) {
      const days = Math.ceil((new Date(g.targetDate) - today) / DAY);
      if (days >= 0 && days <= 7) {
        items.push({
          id: `goal-deadline:${g.id}:${todayKey}`,
          type: 'reminder',
          title: `${g.icon || '🎯'} ${days === 0 ? 'Goal deadline is today' : `${days} day${days === 1 ? '' : 's'} left`}`,
          body: g.title,
          url: `/goals?goal=${g.id}`,
          at: new Date().toISOString(),
          priority: days <= 1 ? 'high' : 'normal',
        });
      }
    }
  }

  /* Habit nudges only in the evening and never inside quiet hours. */
  if (prefs.habitReminders && !quiet && hour >= 18) {
    const pending = habits.filter((h) => !(h.completedDates || []).includes(todayKey));
    if (pending.length) {
      const atRisk = pending.filter((h) => (h.streak || 0) > 0);
      items.push({
        id: `habits:${todayKey}`,
        type: 'habit',
        title: atRisk.length
          ? `${atRisk.length} streak${atRisk.length === 1 ? '' : 's'} at risk tonight`
          : `${pending.length} habit${pending.length === 1 ? '' : 's'} left today`,
        body: pending.slice(0, 4).map((h) => `${h.icon || '✅'} ${h.name}`).join(' · '),
        url: '/habits',
        at: new Date().toISOString(),
        priority: atRisk.length ? 'high' : 'normal',
      });
    }
  }

  const state = user.notificationState || {};
  const read = new Set(Array.isArray(state.readIds) ? state.readIds : []);
  const feed = items
    .map((n) => ({ ...n, read: read.has(n.id) }))
    .sort((a, b) => (a.read - b.read) || (a.priority === 'high' ? -1 : 0) - (b.priority === 'high' ? -1 : 0)
      || new Date(a.at) - new Date(b.at));

  return { items: feed, unread: feed.filter((n) => !n.read).length, quiet, prefs };
}

/** Keep the read list bounded — ids for alerts that no longer exist are useless. */
async function markRead(user, ids, liveIds) {
  const state = user.notificationState || {};
  const current = new Set(Array.isArray(state.readIds) ? state.readIds : []);
  ids.forEach((id) => current.add(String(id)));
  const keep = liveIds ? [...current].filter((id) => liveIds.has(id) || ids.includes(id)) : [...current];
  const next = { ...state, readIds: keep.slice(-500) };
  await prisma.user.update({ where: { id: user.id }, data: { notificationState: next } });
  return next;
}

async function buildWeeklySummary(userId) {
  const since = new Date(startOfToday().getTime() - 6 * DAY);
  const week = Array.from({ length: 7 }, (_, i) => dayKey(new Date(since.getTime() + i * DAY)));
  const weekSet = new Set(week);

  const [habits, sessions, inboxDone, goals, notes] = await Promise.all([
    prisma.habit.findMany({ where: notTrashed(userId), select: { name: true, completedDates: true, streak: true } }),
    prisma.focusSession.findMany({ where: { userId, startedAt: { gte: since } }, select: { kind: true, seconds: true, distance: true } }),
    prisma.inboxItem.count({ where: { userId, completedAt: { gte: since } } }),
    prisma.goal.findMany({ where: notTrashed(userId), select: { title: true, progress: true, status: true, updatedAt: true } }),
    prisma.note.count({ where: { userId, createdAt: { gte: since } } }),
  ]);

  const completions = habits.reduce((s, h) => s + (h.completedDates || []).filter((d) => weekSet.has(d)).length, 0);
  const possible = habits.length * 7;
  const focus = sessions.filter((s) => s.kind === 'focus');
  const runs = sessions.filter((s) => s.kind === 'run');
  return {
    habitRate: possible ? Math.round((completions / possible) * 100) : 0,
    completions,
    longestStreak: habits.reduce((m, h) => Math.max(m, h.streak || 0), 0),
    focusMinutes: Math.round(focus.reduce((s, x) => s + (x.seconds || 0), 0) / 60),
    runs: runs.length,
    runKm: Math.round(runs.reduce((s, x) => s + (x.distance || 0), 0) * 10) / 10,
    inboxDone,
    notes,
    goalsMoved: goals.filter((g) => new Date(g.updatedAt) >= since).length,
    topGoals: goals.filter((g) => g.status !== 'completed' && g.status !== 'abandoned')
      .sort((a, b) => b.progress - a.progress).slice(0, 3),
  };
}

function digestHtml(name, s) {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const stat = (value, label) => `
    <td style="padding:12px;text-align:center;background:#f5f5ff;border-radius:10px">
      <div style="font-size:22px;font-weight:800;color:#4F46E5">${value}</div>
      <div style="font-size:12px;color:#666">${label}</div>
    </td>`;
  const goals = s.topGoals.map((g) => `
    <tr><td style="padding:6px 0;font-size:14px">${g.title.replace(/</g, '&lt;')}</td>
    <td style="padding:6px 0;text-align:right;font-weight:700">${g.progress}%</td></tr>`).join('');
  return `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <h2 style="margin-bottom:4px">Your week, ${name ? name.split(' ')[0] : 'there'} ✨</h2>
    <p style="color:#666;margin-top:0">Here's what you got done in SortLife over the last 7 days.</p>
    <table cellspacing="8" style="width:100%"><tr>
      ${stat(`${s.habitRate}%`, 'habit rate')}${stat(`${s.focusMinutes}m`, 'focused')}${stat(s.runs ? `${s.runs}` : '0', s.runKm ? `runs · ${s.runKm} km` : 'runs')}
    </tr><tr>
      ${stat(s.inboxDone, 'inbox cleared')}${stat(s.goalsMoved, 'goals moved')}${stat(s.longestStreak, 'longest streak')}
    </tr></table>
    ${goals ? `<h3 style="margin:22px 0 6px">Closest goals</h3><table style="width:100%">${goals}</table>` : ''}
    <p style="margin:28px 0">
      <a href="${frontend}/analytics" style="display:inline-block;padding:12px 20px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Open your insights</a>
    </p>
    <p style="color:#999;font-size:12px">You get this because "Weekly summary" is on in Settings → Notifications.</p>
  </div>`;
}

async function sendWeeklyDigest(user, { force = false } = {}) {
  const prefs = pickKnown(user.notificationPrefs || {});
  if (!force && !prefs.weeklySummary) return { sent: false, reason: 'opted_out' };
  const summary = await buildWeeklySummary(user.id);
  const result = await sendEmail({
    to: user.email,
    subject: `Your SortLife week: ${summary.habitRate}% habits, ${summary.focusMinutes} min focused`,
    html: digestHtml(user.name, summary),
  });
  if (result.sent && !force) {
    const state = user.notificationState || {};
    await prisma.user.update({
      where: { id: user.id },
      data: { notificationState: { ...state, lastDigestAt: new Date().toISOString() } },
    });
  }
  return { ...result, summary };
}

/* Monday from 08:00 server time; each user at most once every 6 days. */
async function runDigestTick() {
  const now = new Date();
  if (now.getDay() !== 1 || now.getHours() < 8) return;
  const users = await prisma.user.findMany({
    where: { isVerified: true },
    select: { id: true, name: true, email: true, notificationPrefs: true, notificationState: true },
  });
  for (const user of users) {
    const prefs = pickKnown(user.notificationPrefs || {});
    if (!prefs.weeklySummary) continue;
    const last = user.notificationState?.lastDigestAt ? new Date(user.notificationState.lastDigestAt) : null;
    if (last && now - last < 6 * DAY) continue;
    try {
      await sendWeeklyDigest(user);
    } catch (err) {
      console.error('Weekly digest failed for', user.id, err.message);
    }
  }
}

let timer = null;
function startNotificationScheduler() {
  if (timer || process.env.DISABLE_SCHEDULER === 'true') return;
  const tick = () => runDigestTick().catch((err) => console.error('Digest tick error:', err.message));
  setTimeout(tick, 30 * 1000);
  timer = setInterval(tick, 60 * 60 * 1000);
  if (timer.unref) timer.unref();
}

function stopNotificationScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  buildFeed, markRead, buildWeeklySummary, sendWeeklyDigest,
  startNotificationScheduler, stopNotificationScheduler,
};
