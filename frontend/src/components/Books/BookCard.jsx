import React, { useState } from 'react';
import { Pencil, Trash2, Star, ChevronUp, Lightbulb, BookOpenText } from 'lucide-react';
import { getApiBase } from '../../utils/api';
import ItemActions from '../ItemActions';
import './BookCard.css';

const BACKEND = getApiBase();

const STATUS_LABEL = {
  reading: 'Reading',
  completed: 'Finished',
  'want-to-read': 'To read',
  paused: 'Paused',
};

const COVER_COLORS = ['#7c3aed', '#0ea5e9', '#16a34a', '#e11d48', '#f59e0b', '#0f766e', '#9333ea', '#2563eb'];

export function resolveCoverUrl(coverImage) {
  if (!coverImage) return null;
  if (/^https?:\/\//i.test(coverImage)) return coverImage;
  return `${BACKEND}${coverImage.startsWith('/') ? '' : '/'}${coverImage}`;
}

/** Stable colour per book so plain covers don't all look the same. */
function coverColor(book) {
  const key = String(book._id || book.title || '');
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return COVER_COLORS[h % COVER_COLORS.length];
}

export default function BookCard({ book, onOpen, onEdit, onDelete, onIncrementPage, onLearningLine, onArchived }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [learningOpen, setLearningOpen] = useState(false);
  const [learningText, setLearningText] = useState('');
  const [savingLine, setSavingLine] = useState(false);

  const progress = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
  const canIncrement = book.status !== 'completed';
  const coverSrc = resolveCoverUrl(book.coverImage);

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
    <div className="book-item">
      <div
        className="book-3d"
        style={{ '--cover': coverColor(book) }}
        role="button"
        tabIndex={0}
        onClick={() => onOpen(book)}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(book)}
        title={book.pdfFile ? 'Open and read' : 'Open book'}
      >
        <span className="book-3d-pages" aria-hidden />
        <div className="book-3d-cover">
          {coverSrc ? (
            <img src={coverSrc} alt={book.title} />
          ) : (
            <div className="book-3d-plain">
              <strong>{book.title}</strong>
              <span>{book.author}</span>
            </div>
          )}
          <span className="book-3d-spine" aria-hidden />
          <span className="book-3d-status">{STATUS_LABEL[book.status] || book.status}</span>
          {book.pdfFile && (
            <span className="book-3d-pdf"><BookOpenText size={12} /> Read</span>
          )}
          {book.totalPages > 0 && (
            <span className="book-3d-progress"><span style={{ width: `${progress}%` }} /></span>
          )}

          <div className="book-card-actions" onClick={(e) => e.stopPropagation()}>
            <ItemActions type="book" id={book._id} favorite={book.favorite} onArchived={onArchived} variant="card" size={13} />
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
      </div>

      <div className="book-item-info">
        <h3 className="book-card-title">{book.title}</h3>
        <p className="book-card-author">{book.author}</p>
        <div className="book-item-row">
          {book.rating > 0 ? (
            <span className="book-card-stars">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={11}
                  fill={s <= book.rating ? 'var(--accent-yellow)' : 'none'}
                  color={s <= book.rating ? 'var(--accent-yellow)' : 'var(--text-muted)'}
                />
              ))}
            </span>
          ) : (
            <span className="book-progress-label">
              {book.totalPages > 0 ? `${progress}% read` : book.currentPage > 0 ? `p.${book.currentPage}` : ''}
            </span>
          )}
          {canIncrement && (
            <button className="book-page-btn" onClick={() => onIncrementPage(book._id)} title="Mark one page read">
              <ChevronUp size={12} /> 1 page
            </button>
          )}
        </div>
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
