import React, { useState } from 'react';
import { Pencil, Trash2, BookOpen, Star } from 'lucide-react';
import './BookCard.css';

const BACKEND = 'http://localhost:5000';

const statusClass = {
  reading: 'badge-reading',
  completed: 'badge-completed',
  'want-to-read': 'badge-want-to-read',
  paused: 'badge-paused',
};

export default function BookCard({ book, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const progress = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;

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

        {book.status === 'reading' && (
          <div className="book-progress">
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${progress}%`, background: 'var(--accent-green)' }} />
            </div>
            <span className="book-progress-label">{progress}% · p.{book.currentPage}/{book.totalPages}</span>
          </div>
        )}

        {book.genre && <span className="book-genre">{book.genre}</span>}
      </div>
    </div>
  );
}
