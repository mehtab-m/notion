const mongoose = require('mongoose');

const SubTaskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    done: { type: Boolean, default: false },
    assignee: { type: String, default: '' },
  },
  { _id: false }
);

const TaskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    done: { type: Boolean, default: false },
    assignee: { type: String, default: '' },
    subtasks: { type: [SubTaskSchema], default: [] },
  },
  { _id: false }
);

const ColumnSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'dropdown', 'image', 'checkbox', 'url'],
      default: 'text',
    },
    options: [{ type: String }],
  },
  { _id: false }
);

const TableRowSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const DataTableSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    columns: { type: [ColumnSchema], default: [] },
    rows: { type: [TableRowSchema], default: [] },
  },
  { _id: false }
);

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
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
  tasks: { type: [TaskSchema], default: [] },
  dataTables: { type: [DataTableSchema], default: [] },
  team: [{ type: String }],
  assignees: [{ type: String }],
  color: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Project', ProjectSchema);
