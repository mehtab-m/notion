/** Scope queries to the logged-in user (Prisma where clauses) */
function uid(req) {
  if (!req.user?.id) {
    throw new Error('Authentication required');
  }
  return req.user.id;
}

function owned(req, extra = {}) {
  const where = { userId: uid(req) };
  if (extra._id != null) {
    where.id = extra._id;
    const { _id, ...rest } = extra;
    return { ...where, ...rest };
  }
  return { ...where, ...extra };
}

module.exports = { uid, owned };
