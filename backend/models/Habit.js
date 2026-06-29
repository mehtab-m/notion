const mongoose = require('mongoose');

const HabitSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '✅' },
  color: { type: String, default: 'var(--accent)' },
  frequency: {
    type: String,
    enum: ['daily', 'weekly'],
    default: 'daily',
  },
  // Array of date strings "YYYY-MM-DD" when the habit was completed
  completedDates: [{ type: String }],
  streak: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Habit', HabitSchema);
