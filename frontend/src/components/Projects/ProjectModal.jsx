import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createProject } from '../../utils/api';
import './ProjectModal.css';

const defaultForm = {
  title: '',
  dueDate: '',
};

export default function ProjectModal({ onClose, onSaved, onCreated }) {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);

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
    if (!form.title.trim()) { toast.error('Project name is required'); return; }
    setLoading(true);
    try {
      const payload = {
        title: form.title.trim(),
        dueDate: form.dueDate || undefined,
        status: 'active',
        tasks: [],
        dataTables: [],
        team: [],
      };
      const created = await createProject(payload);
      toast.success('Project created!');
      onSaved?.();
      if (onCreated) {
        onCreated(created);
      } else {
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card project-modal-card project-modal-simple" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Project</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="pm-simple-hint">Start with a name and deadline. Add tasks, data tables, and team members inside the project.</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Project Name *</label>
            <input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Mobile App Redesign" autoFocus />
          </div>
          <div className="form-group">
            <label>Deadline</label>
            <input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
