import React, { useState, useEffect } from 'react';
import { X, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { createShow, updateShow } from '../../utils/api';
import './ShowModal.css';

const PLATFORMS = ['Netflix', 'HBO', 'Disney+', 'Apple TV+', 'Amazon Prime', 'Hulu', 'Other'];

const defaultForm = {
  title: '',
  platform: 'Other',
  status: 'want-to-watch',
  currentSeason: 1,
  currentEpisode: 0,
  totalSeasons: 1,
  rating: 0,
  genre: '',
  notes: '',
  posterImageUrl: '',
};

function isExternalUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

export default function ShowModal({ show, onClose, onSaved }) {
  const [form, setForm] = useState(defaultForm);
  const [imageFile, setImageFile] = useState(null);
  const [hoverRating, setHoverRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(show);

  useEffect(() => {
    if (show) {
      const existing = show.posterImage || '';
      setForm({
        title: show.title || '',
        platform: show.platform || 'Other',
        status: show.status || 'want-to-watch',
        currentSeason: show.currentSeason || 1,
        currentEpisode: show.currentEpisode || 0,
        totalSeasons: show.totalSeasons || 1,
        rating: show.rating || 0,
        genre: show.genre || '',
        notes: show.notes || '',
        posterImageUrl: isExternalUrl(existing) ? existing : '',
      });
    } else {
      setForm(defaultForm);
    }
    setImageFile(null);
  }, [show]);

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
    if (form.posterImageUrl.trim() && !isExternalUrl(form.posterImageUrl)) {
      toast.error('Poster URL must start with http:// or https://');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'posterImageUrl') return;
        fd.append(k, v);
      });
      if (imageFile) {
        fd.append('posterImage', imageFile);
      } else if (form.posterImageUrl.trim()) {
        fd.append('posterImageUrl', form.posterImageUrl.trim());
      }
      if (isEdit) {
        await updateShow(show._id, fd);
        toast.success('Show updated!');
      } else {
        await createShow(fd);
        toast.success('Show added!');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save show');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Show' : 'Add Show'}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Title *</label>
              <input name="title" value={form.title} onChange={handleChange} placeholder="Show title..." autoFocus />
            </div>
            <div className="form-group">
              <label>Platform</label>
              <select name="platform" value={form.platform} onChange={handleChange}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="want-to-watch">Want to Watch</option>
                <option value="watching">Watching</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>
            <div className="form-group">
              <label>Genre</label>
              <input name="genre" value={form.genre} onChange={handleChange} placeholder="Drama, Sci-Fi..." />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Current Season</label>
              <input type="number" name="currentSeason" min="1" value={form.currentSeason} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Current Episode</label>
              <input type="number" name="currentEpisode" min="0" value={form.currentEpisode} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Total Seasons</label>
              <input type="number" name="totalSeasons" min="1" value={form.totalSeasons} onChange={handleChange} />
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
            <label>Poster image URL</label>
            <input
              name="posterImageUrl"
              value={form.posterImageUrl}
              onChange={handleChange}
              placeholder="https://example.com/poster.jpg"
              disabled={!!imageFile}
            />
            <p className="form-hint">Paste a direct image link, or upload a file below (file wins if both set).</p>
          </div>
          <div className="form-group">
            <label>Or upload poster</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setImageFile(e.target.files[0] || null);
                if (e.target.files[0]) setForm((p) => ({ ...p, posterImageUrl: '' }));
              }}
              className="file-input"
            />
            {imageFile && (
              <button
                type="button"
                className="clear-rating"
                style={{ marginTop: 8 }}
                onClick={() => setImageFile(null)}
              >
                Clear file
              </button>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Add Show'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
