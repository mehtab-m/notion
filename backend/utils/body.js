/** Remove client/meta fields before Prisma writes */
function cleanBody(body, extra = []) {
  const copy = { ...body };
  for (const k of ['_id', 'id', 'userId', '__v', 'createdAt', 'updatedAt', ...extra]) {
    delete copy[k];
  }
  return copy;
}

function num(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function parseDate(val) {
  if (val === '' || val == null) return undefined;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function flattenMilestoneProgress(milestones = []) {
  let total = 0;
  let done = 0;
  for (const m of milestones) {
    const kids = Array.isArray(m.children) ? m.children : [];
    if (kids.length) {
      total += kids.length;
      done += kids.filter((c) => c.done).length;
      // Parent counts as extra unit when all kids done or parent marked done
      total += 1;
      if (m.done || kids.every((c) => c.done)) done += 1;
    } else {
      total += 1;
      if (m.done) done += 1;
    }
  }
  return { total, done, progress: total > 0 ? Math.round((done / total) * 100) : 0 };
}

function unlockAchievements(goal, milestones, progress) {
  const existing = Array.isArray(goal.achievements) ? [...goal.achievements] : [];
  const has = (key) => existing.some((a) => a.key === key);
  const add = (key, title) => {
    if (!has(key)) {
      existing.push({
        id: `${key}-${Date.now()}`,
        key,
        title,
        unlockedAt: new Date().toISOString(),
      });
    }
  };

  const msDone = milestones.filter((m) => m.done).length;
  const childDone = milestones.reduce(
    (n, m) => n + (Array.isArray(m.children) ? m.children.filter((c) => c.done).length : 0),
    0
  );

  if (msDone + childDone >= 1) add('first_win', 'First micro-win');
  if (progress >= 25) add('quarter', 'Quarter orbit');
  if (progress >= 50) add('halfway', 'Halfway constellation');
  if (progress >= 75) add('three_quarters', 'Almost there');
  if (progress >= 100 || goal.status === 'completed') add('complete', 'Goal completed');
  if ((milestones || []).length >= 3) add('architect', 'Goal architect');
  if (childDone >= 5) add('builder', 'Subgoal builder');

  return existing;
}

function prepareGoalData(body) {
  const data = cleanBody(body, ['role']);
  const targetDate = parseDate(data.targetDate);
  if (targetDate) data.targetDate = targetDate;
  else delete data.targetDate;
  if (data.progress != null) data.progress = num(data.progress, 0);
  if (data.momentum != null) data.momentum = num(data.momentum, 0);
  if (!data.milestones) data.milestones = [];
  if (!Array.isArray(data.achievements)) delete data.achievements;
  if (data.why == null) data.why = '';
  if (data.horizon && !['sprint', 'season', 'year', 'lifetime'].includes(data.horizon)) {
    data.horizon = 'season';
  }
  return data;
}

module.exports = {
  cleanBody,
  num,
  parseDate,
  prepareGoalData,
  flattenMilestoneProgress,
  unlockAchievements,
};
