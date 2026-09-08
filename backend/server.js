require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const prisma = require('./lib/prisma');

const authRouter = require('./routes/auth');
const stripeRouter = require('./routes/stripe');
const { handleStripeWebhook } = require('./services/stripeWebhook');
const { authMiddleware } = require('./middleware/auth');
const { notFound, errorHandler, asyncHandler } = require('./middleware/errors');
const { apiLimiter } = require('./middleware/rateLimit');
const searchRouter = require('./routes/search');
const projectsRouter = require('./routes/projects');
const booksRouter = require('./routes/books');
const showsRouter = require('./routes/shows');
const tablesRouter = require('./routes/tables');
const notesRouter = require('./routes/notes');
const stickyNotesRouter = require('./routes/stickynotes');
const habitsRouter = require('./routes/habits');
const goalsRouter = require('./routes/goals');
const dashboardRouter = require('./routes/dashboard');
const adminRouter = require('./routes/admin');
const moneyRouter = require('./routes/money');
const lifecycleRouter = require('./routes/lifecycle');
const inboxRouter = require('./routes/inbox');
const focusRouter = require('./routes/focus');
const analyticsRouter = require('./routes/analytics');
const dataRouter = require('./routes/dataTransfer');

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PROD = process.env.NODE_ENV === 'production';

/* Render/Vercel/Fly put us behind a proxy — without this req.ip is
   the proxy's address and every rate limit shares one bucket. */
app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ─── Security headers ──────────────────────────────────── */
app.use(
  helmet({
    // This process serves JSON plus user uploads, never HTML, so a
    // page-oriented CSP buys nothing and breaks nothing either way.
    contentSecurityPolicy: false,
    // Uploaded images are rendered by the frontend on another origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: IS_PROD ? { maxAge: 15552000, includeSubDomains: true } : false,
  })
);

/* ─── CORS ──────────────────────────────────────────────── */
const ALLOWED_ORIGINS = [
  'https://notion-lovat-psi.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'https://sortlife.com',
  'https://www.sortlife.com',
  process.env.FRONTEND_URL?.replace(/\/$/, ''),
].filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // Same-origin, curl and native clients send no Origin header.
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ''))) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    maxAge: 86400,
  })
);

/* ─── Payload handling ──────────────────────────────────── */
app.use(compression());

/*
 * Stripe webhook MUST receive the raw request body.
 *
 * This route is intentionally before express.json().
 * It is also intentionally outside authMiddleware because
 * Stripe cannot send our application's JWT.
 */
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

// Note bodies embed base64 images, so the ceiling has to be generous â€”
// but 50mb of JSON per request was an easy way to exhaust memory.
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

if (!IS_PROD) app.use(morgan('dev'));
else app.use(morgan('combined', { skip: (_req, res) => res.statusCode < 400 }));

/* Uploaded media is immutable once written — let browsers keep it. */
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '30d',
    immutable: true,
    fallthrough: true,
  })
);

/* ─── Health ────────────────────────────────────────────── */
app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.get(
  '/api/health/deep',
  asyncHandler(async (_req, res) => {
    const started = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'up', latencyMs: Date.now() - started, uptime: process.uptime() });
  })
);

/* ─── Routes ────────────────────────────────────────────── */
app.use('/api/auth', authRouter);

app.use('/api', authMiddleware, apiLimiter);
app.use('/api/stripe', stripeRouter);
app.use('/api/admin', adminRouter);
app.use('/api/search', searchRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/books', booksRouter);
app.use('/api/shows', showsRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/notes', notesRouter);
app.use('/api/stickynotes', stickyNotesRouter);
app.use('/api/habits', habitsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/money', moneyRouter);
app.use('/api/lifecycle', lifecycleRouter);
app.use('/api/inbox', inboxRouter);
app.use('/api/focus', focusRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/data', dataRouter);

app.use(notFound);
app.use(errorHandler);

/* ─── Lifecycle ─────────────────────────────────────────── */
let server;

async function start() {
  try {
    await prisma.$connect();
    console.log('PostgreSQL connected via Prisma');
    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
    });
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 70000;
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
}

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received — shutting down`);

  // Stop accepting connections, then let in-flight requests finish.
  const forced = setTimeout(() => {
    console.error('Shutdown timed out — exiting');
    process.exit(1);
  }, 10000);
  forced.unref();

  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
    console.log('Shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown('uncaughtException');
});

start();

module.exports = app;
