import React, { useState, useEffect } from 'react';
import { X, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { createBook, updateBook } from '../../utils/api';
import './BookModal.css';

const defaultForm = {
  title: '',
  author: '',
  status: 'want-to-read',
  currentPage: 0,
  totalPages: 0,
  rating: 0,
  genre: '',
  notes: '',
};

export default function BookModal({ book, onClose, onSaved }) {
  const [form, setForm] = useState(defaultForm);
  const [imageFile, setImageFile] = useState(null);
  const [hoverRating, setHoverRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(book);

  useEffect(() => {
    if (book) {
      setForm({
        title: book.title || '',
        author: book.author || '',
        status: book.status || 'want-to-read',
        currentPage: book.currentPage || 0,
        totalPages: book.totalPages || 0,
        rating: book.rating || 0,
        genre: book.genre || '',
        notes: book.notes || '',
      });
    } else {
      setForm(defaultForm);
    }
  }, [book]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.author.trim()) { toast.error('Author is required'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append('coverImage', imageFile);
      if (isEdit) {
        await updateBook(book._id, fd);
        toast.success('Book updated!');
      } else {
        await createBook(fd);
        toast.success('Book added!');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save book');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Book' : 'Add Book'}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Title *</label>
              <input name="title" value={form.title} onChange={handleChange} placeholder="Book title..." autoFocus />
            </div>
            <div className="form-group">
              <label>Author *</label>
              <input name="author" value={form.author} onChange={handleChange} placeholder="Author name..." />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="want-to-read">Want to Read</option>
                <option value="reading">Reading</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="form-group">
              <label>Genre</label>
              <input name="genre" value={form.genre} onChange={handleChange} placeholder="Fiction, Sci-Fi..." />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Current Page</label>
              <input type="number" name="currentPage" min="0" value={form.currentPage} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Total Pages</label>
              <input type="number" name="totalPages" min="0" value={form.totalPages} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label>Rating</label>
            <div className="star-input">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  type="button"
                  key={s}
                  className="star-btn"
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setForm((prev) => ({ ...prev, rating: s }))}
                >
                  <Star
                    size={20}
                    fill={s <= (hoverRating || form.rating) ? 'var(--accent-yellow)' : 'none'}
                    color={s <= (hoverRating || form.rating) ? 'var(--accent-yellow)' : 'var(--text-muted)'}
                  />
                </button>
              ))}
              {form.rating > 0 && (
                <button type="button" className="clear-rating" onClick={() => setForm((p) => ({ ...p, rating: 0 }))}>
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Your thoughts..." />
          </div>
          <div className="form-group">
            <label>Cover Image</label>
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="file-input" />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
