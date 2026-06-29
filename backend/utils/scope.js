/** Helpers to scope all DB queries to the logged-in user */
function uid(req) {
  return req.user._id;
}

function owned(req, extra = {}) {
  return { ...extra, userId: req.user._id };
}

module.exports = { uid, owned };
