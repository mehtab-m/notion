require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

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

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public auth routes
app.use('/api/auth', authRouter);

// Protected API routes
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

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
