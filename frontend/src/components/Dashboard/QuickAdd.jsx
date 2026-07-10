import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createProject, createBook, createShow } from '../../utils/api';
import './QuickAdd.css';

export default function QuickAdd({ onAdded, hideProjects = false }) {
  const [modal, setModal] = useState(null); // 'project' | 'book' | 'show'
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!modal) { setForm({}); return; }
    const handleKey = (e) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modal]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title?.trim()) { toast.error('Title is required'); return; }
    setLoading(true);
    try {
      if (modal === 'project') {
        await createProject({ title: form.title });
        toast.success('Project created!');
      } else if (modal === 'book') {
        if (!form.author?.trim()) { toast.error('Author is required'); setLoading(false); return; }
        const fd = new FormData();
        fd.append('title', form.title);
        fd.append('author', form.author);
        await createBook(fd);
        toast.success('Book added!');
      } else if (modal === 'show') {
        const fd = new FormData();
        fd.append('title', form.title);
        fd.append('platform', form.platform || 'Other');
        await createShow(fd);
        toast.success('Show added!');
      }
      setModal(null);
      if (onAdded) onAdded();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="quick-add">
        <span className="quick-add-label">Quick Add:</span>
        {!hideProjects && (
          <button className="quick-add-btn" onClick={() => setModal('project')}>
            <Plus size={14} /> Project
          </button>
        )}
        <button className="quick-add-btn" onClick={() => setModal('book')}>
          <Plus size={14} /> Book
        </button>
        <button className="quick-add-btn" onClick={() => setModal('show')}>
          <Plus size={14} /> Show
        </button>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card quick-add-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Quick Add {modal.charAt(0).toUpperCase() + modal.slice(1)}</h2>
              <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input name="title" value={form.title || ''} onChange={handleChange} placeholder="Enter title..." autoFocus />
              </div>
              {modal === 'book' && (
                <div className="form-group">
                  <label>Author *</label>
                  <input name="author" value={form.author || ''} onChange={handleChange} placeholder="Enter author..." />
                </div>
              )}
              {modal === 'show' && (
                <div className="form-group">
                  <label>Platform</label>
                  <select name="platform" value={form.platform || 'Other'} onChange={handleChange}>
                    {['Netflix', 'HBO', 'Disney+', 'Apple TV+', 'Amazon Prime', 'Hulu', 'Other'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
