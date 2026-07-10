const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  status: {
    type: String,
    enum: ['reading', 'completed', 'want-to-read', 'paused'],
    default: 'want-to-read',
  },
  currentPage: { type: Number, default: 0 },
  totalPages: { type: Number, default: 0 },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  genre: { type: String },
  notes: { type: String },
  coverImage: { type: String },
  notebookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startedAt: { type: Date },
  finishedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Book', BookSchema);
