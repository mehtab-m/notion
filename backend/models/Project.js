const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const LinkSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String },
    url: { type: String, required: true },
  },
  { _id: false }
);

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: {
    type: String,
    enum: ['active', 'completed', 'on-hold', 'planned'],
    default: 'active',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  dueDate: { type: Date },
  tags: [{ type: String }],
  tasks: [TaskSchema],
  links: [LinkSchema],
  assignees: [{ type: String }],
  color: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Project', ProjectSchema);
