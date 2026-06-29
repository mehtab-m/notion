const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const Goal = require('../models/Goal');
const Habit = require('../models/Habit');
const Project = require('../models/Project');
const { owned } = require('../utils/scope');

router.get('/stats', async (req, res) => {
  try {
    const filter = owned(req);
    const [books, goals, habits, projects] = await Promise.all([
      Book.find(filter),
      Goal.find(filter),
      Habit.find(filter),
      Project.find(filter),
    ]);

    const bookProgress = books.map((b) => ({
      _id: b._id,
      title: b.title,
      author: b.author,
      status: b.status,
      currentPage: b.currentPage,
      totalPages: b.totalPages,
      progress: b.totalPages > 0 ? Math.round((b.currentPage / b.totalPages) * 100) : 0,
      coverImage: b.coverImage,
    }));

    const goalProgress = goals.map((g) => ({
      _id: g._id,
      title: g.title,
      category: g.category,
      status: g.status,
      progress: g.progress,
    }));

    const habitStats = habits.map((h) => ({
      _id: h._id,
      name: h.name,
      streak: h.streak,
      completedCount: (h.completedDates || []).length,
      color: h.color,
    }));

    const projectProgress = projects
      .filter((p) => p.status === 'active')
      .map((p) => ({
        _id: p._id,
        title: p.title,
        progress: p.progress,
        priority: p.priority,
      }));

    const booksByStatus = {
      reading: books.filter((b) => b.status === 'reading').length,
      completed: books.filter((b) => b.status === 'completed').length,
      'want-to-read': books.filter((b) => b.status === 'want-to-read').length,
      paused: books.filter((b) => b.status === 'paused').length,
    };

    const goalsByStatus = {
      'in-progress': goals.filter((g) => g.status === 'in-progress').length,
      completed: goals.filter((g) => g.status === 'completed').length,
      'not-started': goals.filter((g) => g.status === 'not-started').length,
      abandoned: goals.filter((g) => g.status === 'abandoned').length,
    };

    res.json({
      bookProgress,
      goalProgress,
      habitStats,
      projectProgress,
      booksByStatus,
      goalsByStatus,
      totals: {
        books: books.length,
        goals: goals.length,
        habits: habits.length,
        projects: projects.length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
