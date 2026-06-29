import React, { useState } from 'react';
import { Pencil, Trash2, BookOpen, Star, ChevronUp, Lightbulb } from 'lucide-react';
import { getApiBase } from '../../utils/api';
import './BookCard.css';

const BACKEND = getApiBase();

const statusClass = {
  reading: 'badge-reading',
  completed: 'badge-completed',
  'want-to-read': 'badge-want-to-read',
  paused: 'badge-paused',
};

export default function BookCard({ book, onEdit, onDelete, onIncrementPage, onLearningLine }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [learningOpen, setLearningOpen] = useState(false);
  const [learningText, setLearningText] = useState('');
  const [savingLine, setSavingLine] = useState(false);

  const progress = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
  const showProgress = book.totalPages > 0 || book.currentPage > 0;
  const canIncrement = book.status !== 'completed';

  const handleSaveLearning = async () => {
    if (!learningText.trim()) return;
    setSavingLine(true);
    try {
      await onLearningLine(book._id, learningText.trim());
      setLearningText('');
      setLearningOpen(false);
    } finally {
      setSavingLine(false);
    }
  };

  return (
    <div className="book-card">
      <div className="book-card-cover">
        {book.coverImage ? (
          <img src={`${BACKEND}${book.coverImage}`} alt={book.title} />
        ) : (
          <div className="book-cover-placeholder">
            <BookOpen size={28} color="var(--accent-green)" />
          </div>
        )}
        <div className="book-card-actions">
          <button className="card-action-btn" onClick={() => setLearningOpen(true)} title="Add learning line">
            <Lightbulb size={13} />
          </button>
          <button className="card-action-btn" onClick={() => onEdit(book)} title="Edit">
            <Pencil size={13} />
          </button>
          {!confirmDelete ? (
            <button className="card-action-btn danger" onClick={() => setConfirmDelete(true)} title="Delete">
              <Trash2 size={13} />
            </button>
          ) : (
            <div className="confirm-delete">
              <button className="btn btn-danger btn-sm" onClick={() => onDelete(book._id)}>Yes</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>No</button>
            </div>
          )}
        </div>
      </div>

      <div className="book-card-body">
        <span className={`badge ${statusClass[book.status] || ''}`}>{book.status.replace('-', ' ')}</span>
        <h3 className="book-card-title">{book.title}</h3>
        <p className="book-card-author">{book.author}</p>

        {book.rating > 0 && (
          <div className="book-card-stars">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={13}
                fill={s <= book.rating ? 'var(--accent-yellow)' : 'none'}
                color={s <= book.rating ? 'var(--accent-yellow)' : 'var(--text-muted)'}
              />
            ))}
          </div>
        )}

        {showProgress && (
          <div className="book-progress">
            {book.totalPages > 0 && (
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progress}%`, background: 'var(--accent-green)' }} />
              </div>
            )}
            <div className="book-progress-row">
              <span className="book-progress-label">
                {book.totalPages > 0 ? `${progress}% · ` : ''}p.{book.currentPage}{book.totalPages > 0 ? `/${book.totalPages}` : ''}
              </span>
              {canIncrement && (
                <button
                  className="book-page-btn"
                  onClick={() => onIncrementPage(book._id)}
                  title="Mark page read"
                >
                  <ChevronUp size={14} /> +1 page
                </button>
              )}
            </div>
          </div>
        )}

        {!showProgress && canIncrement && (
          <button className="book-page-btn book-page-btn--solo" onClick={() => onIncrementPage(book._id)}>
            <ChevronUp size={14} /> +1 page read
          </button>
        )}

        {book.genre && <span className="book-genre">{book.genre}</span>}
      </div>

      {learningOpen && (
        <div className="learning-line-modal" onClick={() => setLearningOpen(false)}>
          <div className="learning-line-box" onClick={(e) => e.stopPropagation()}>
            <h4>💡 Learning Line</h4>
            <p className="learning-line-hint">Saved to <strong>{book.title}</strong> notebook</p>
            <textarea
              value={learningText}
              onChange={(e) => setLearningText(e.target.value)}
              placeholder="What did you learn from this page?"
              autoFocus
              rows={4}
            />
            <div className="learning-line-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setLearningOpen(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveLearning} disabled={savingLine || !learningText.trim()}>
                {savingLine ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
