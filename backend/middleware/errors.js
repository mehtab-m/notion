/* ─── Centralised error handling ───────────────────────────
   Routes throw; this layer decides the status code and the
   message the client is allowed to see. Internal details are
   logged server-side and never leaked in production.        */

const IS_PROD = process.env.NODE_ENV === 'production';

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.expose = true;
  }
}

const badRequest = (msg, details) => new ApiError(400, msg, details);
const unauthorized = (msg = 'Authentication required') => new ApiError(401, msg);
const forbidden = (msg = 'You do not have access to this') => new ApiError(403, msg);
const notFoundError = (msg = 'Not found') => new ApiError(404, msg);
const conflict = (msg) => new ApiError(409, msg);

/* Wrap an async route handler so a rejected promise reaches the
   error middleware instead of hanging the request forever. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/* Prisma surfaces failures as coded errors — translate the ones
   that are really client mistakes into proper 4xx responses. */
function fromPrisma(err) {
  switch (err.code) {
    case 'P2002': {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'value';
      return new ApiError(409, `That ${target} is already taken`);
    }
    case 'P2025':
      return new ApiError(404, 'Not found');
    case 'P2003':
      return new ApiError(400, 'Referenced record does not exist');
    case 'P2000':
      return new ApiError(400, 'A value is too long for its field');
    default:
      return null;
  }
}

function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity
function errorHandler(err, req, res, _next) {
  let error = err;

  if (!(error instanceof ApiError)) {
    const mapped = error?.code?.startsWith?.('P2') ? fromPrisma(error) : null;
    if (mapped) {
      error = mapped;
    } else if (error?.name === 'ValidationError' || error?.type === 'entity.parse.failed') {
      error = new ApiError(400, 'Malformed request body');
    } else if (error?.code === 'LIMIT_FILE_SIZE') {
      error = new ApiError(413, 'File is too large');
    } else if (error?.code === 'LIMIT_UNEXPECTED_FILE') {
      error = new ApiError(400, 'Unexpected file upload field');
    }
  }

  const status = error.status || 500;

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  const body = {
    error: status >= 500 && IS_PROD ? 'Something went wrong on our end' : error.message,
  };
  if (error.details) body.details = error.details;
  if (!IS_PROD && status >= 500) body.stack = err.stack;

  res.status(status).json(body);
}

module.exports = {
  ApiError,
  asyncHandler,
  badRequest,
  unauthorized,
  forbidden,
  notFoundError,
  conflict,
  notFound,
  errorHandler,
};
