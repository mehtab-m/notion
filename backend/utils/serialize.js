/** Map Prisma records to Mongo-style API responses (id → _id) */
function serialize(doc, opts = {}) {
  const { keepId = false } = opts;
  if (doc == null) return doc;
  if (Array.isArray(doc)) return doc.map((item) => serialize(item, opts));
  if (doc instanceof Date) return doc.toISOString();
  if (typeof doc !== 'object') return doc;

  const out = {};
  for (const [key, val] of Object.entries(doc)) {
    if (key === 'id') {
      out._id = val;
      if (keepId) out.id = val;
    } else if (val instanceof Date) {
      out[key] = val.toISOString();
    } else if (Array.isArray(val)) {
      out[key] = val.map((item) => (item instanceof Date ? item.toISOString() : serialize(item, opts)));
    } else if (val && typeof val === 'object' && val.constructor === Object) {
      out[key] = serialize(val, opts);
    } else {
      out[key] = val;
    }
  }
  return out;
}

/** Row/column sub-resources keep both id and _id for table editors */
function serializeTablePart(doc) {
  return serialize(doc, { keepId: true });
}

function send(res, status, data) {
  return res.status(status).json(serialize(data));
}

module.exports = { serialize, send, serializeTablePart };
