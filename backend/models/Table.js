const mongoose = require('mongoose');

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

const RowSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const TableSchema = new mongoose.Schema({
  name: { type: String, required: true },
  columns: [ColumnSchema],
  rows: [RowSchema],
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Table', TableSchema);
