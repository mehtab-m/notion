const mongoose = require('mongoose');

const ShowSchema = new mongoose.Schema({
  title: { type: String, required: true },
  platform: {
    type: String,
    enum: ['Netflix', 'HBO', 'Disney+', 'Apple TV+', 'Amazon Prime', 'Hulu', 'Other'],
    default: 'Other',
  },
  status: {
    type: String,
    enum: ['watching', 'completed', 'want-to-watch', 'paused', 'dropped'],
    default: 'want-to-watch',
  },
  currentSeason: { type: Number, default: 1 },
  currentEpisode: { type: Number, default: 0 },
  totalSeasons: { type: Number, default: 1 },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  genre: { type: String },
  notes: { type: String },
  posterImage: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Show', ShowSchema);
