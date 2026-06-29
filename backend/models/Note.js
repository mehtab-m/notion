const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema({
  type: { type: String, enum: ['text', 'image'], default: 'text' },
  content: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  order: { type: Number, default: 0 },
});

const NoteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, default: '' },
  folder: { type: String, default: 'General' },
  tags: [{ type: String }],
  pinned: { type: Boolean, default: false },
  color: { type: String, default: '' },
  isNotebook: { type: Boolean, default: false },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', default: null },
  notebookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', default: null },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', default: null },
  blocks: [BlockSchema],
  order: { type: Number, default: 0 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Note', NoteSchema);
