const prisma = require('../lib/prisma');

/** Append one row to a project's activity trail. Never throws — history must not break a save. */
async function logProjectActivity(projectId, user, type, summary, metadata = {}) {
  try {
    await prisma.projectActivity.create({
      data: {
        projectId,
        userId: user?.id || null,
        userName: user?.name || '',
        type,
        summary: String(summary || '').slice(0, 500),
        metadata: JSON.parse(JSON.stringify(metadata || {})),
      },
    });
  } catch (err) {
    console.warn('[project-activity]', err.message);
  }
}

const TASK_STATUSES = ['inbox', 'ready', 'in_progress', 'blocked', 'review', 'done'];
const TASK_PRIORITIES = ['urgent', 'high', 'medium', 'low'];

/** Older tasks only had `done`; give every task a workflow status. */
function taskStatus(task) {
  if (task && TASK_STATUSES.includes(task.status)) return task.status;
  return task?.done ? 'done' : 'ready';
}

module.exports = { logProjectActivity, TASK_STATUSES, TASK_PRIORITIES, taskStatus };
