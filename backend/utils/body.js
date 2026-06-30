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

function prepareGoalData(body) {
  const data = cleanBody(body);
  const targetDate = parseDate(data.targetDate);
  if (targetDate) data.targetDate = targetDate;
  else delete data.targetDate;
  if (data.progress != null) data.progress = num(data.progress, 0);
  if (!data.milestones) data.milestones = [];
  return data;
}

module.exports = { cleanBody, num, parseDate, prepareGoalData };
