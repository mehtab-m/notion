require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const prisma = require('./lib/prisma');

const authRouter = require('./routes/auth');
const { authMiddleware } = require('./middleware/auth');
const projectsRouter = require('./routes/projects');
const booksRouter = require('./routes/books');
const showsRouter = require('./routes/shows');
const tablesRouter = require('./routes/tables');
const notesRouter = require('./routes/notes');
const stickyNotesRouter = require('./routes/stickynotes');
const habitsRouter = require('./routes/habits');
const goalsRouter = require('./routes/goals');
const dashboardRouter = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [
    'https://notion-lovat-psi.vercel.app',
    'http://localhost:5173',
    'https://sortlife.com',
    'https://www.sortlife.com',
    process.env.FRONTEND_URL?.replace(/\/$/, ''),
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);

app.use('/api', authMiddleware);
app.use('/api/projects', projectsRouter);
app.use('/api/books', booksRouter);
app.use('/api/shows', showsRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/notes', notesRouter);
app.use('/api/stickynotes', stickyNotesRouter);
app.use('/api/habits', habitsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/dashboard', dashboardRouter);

async function start() {
  try {
    await prisma.$connect();
    console.log('PostgreSQL connected via Prisma');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();
