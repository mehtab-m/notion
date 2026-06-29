const mongoose = require('mongoose');

const StickyNoteSchema = new mongoose.Schema({
  content: { type: String, default: '' },
  color: {
    type: String,
    enum: ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'],
    default: 'yellow',
  },
  pinned: { type: Boolean, default: false },
  posX: { type: Number, default: 0 },
  posY: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('StickyNote', StickyNoteSchema);
