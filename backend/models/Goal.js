const mongoose = require('mongoose');

const MilestoneSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    done: { type: Boolean, default: false },
    dueDate: { type: Date },
  },
  { _id: false }
);

const GoalSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  category: {
    type: String,
    enum: ['personal', 'work', 'health', 'finance', 'learning', 'other'],
    default: 'personal',
  },
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed', 'abandoned'],
    default: 'not-started',
  },
  targetDate: { type: Date },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  milestones: [MilestoneSchema],
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Goal', GoalSchema);
