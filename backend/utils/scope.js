/** Scope queries to the logged-in user (Prisma where clauses) */
function uid(req) {
  return req.user.id;
}

function owned(req, extra = {}) {
  const where = { userId: req.user.id };
  if (extra._id != null) {
    where.id = extra._id;
    const { _id, ...rest } = extra;
    return { ...where, ...rest };
  }
  return { ...where, ...extra };
}

module.exports = { uid, owned };
