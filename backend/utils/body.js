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

module.exports = { cleanBody, num };
