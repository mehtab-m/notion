import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Target, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import useApi from '../hooks/useApi';
import { getGoals, createGoal, updateGoal, deleteGoal, toggleMilestone } from '../utils/api';
import './GoalsPage.css';

const CATEGORIES = ['personal', 'work', 'health', 'finance', 'learning', 'other'];
const STATUSES = ['not-started', 'in-progress', 'completed', 'abandoned'];

const catColors = {
  personal: 'var(--accent)',
  work: 'var(--accent-blue)',
  health: 'var(--accent-green)',
  finance: 'var(--accent-yellow)',
  learning: '#8b5cf6',
  other: 'var(--text-muted)',
};

const statusClass = {
  'not-started': 'badge-planned',
  'in-progress': 'badge-active',
  completed: 'badge-completed',
  abandoned: 'badge-dropped',
};

function GoalModal({ goal, onClose, onSaved }) {
  const isEdit = Boolean(goal);
  const [form, setForm] = useState({
    title: '', description: '', category: 'personal',
    status: 'not-started', targetDate: '', progress: 0,
  });
  const [milestones, setMilestones] = useState([]);
  const [msInput, setMsInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (goal) {
      setForm({
        title: goal.title || '',
        description: goal.description || '',
        category: goal.category || 'personal',
        status: goal.status || 'not-started',
        targetDate: goal.targetDate ? goal.targetDate.slice(0, 10) : '',
        progress: goal.progress || 0,
      });
      setMilestones(goal.milestones ? goal.milestones.map((m) => ({ ...m })) : []);
    }
  }, [goal]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const addMilestone = () => {
    if (!msInput.trim()) return;
    setMilestones((p) => [...p, { id: crypto.randomUUID(), text: msInput.trim(), done: false }]);
    setMsInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setLoading(true);
    try {
      const payload = { ...form, progress: Number(form.progress), milestones, targetDate: form.targetDate || undefined };
      if (isEdit) {
        await updateGoal(goal._id, payload);
        toast.success('Goal updated!');
      } else {
        await createGoal(payload);
        toast.success('Goal created!');
      }
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to save goal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Goal' : 'New Goal'}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="What do you want to achieve?" autoFocus />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Why is this goal important?" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/-/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Target Date</label>
              <input type="date" value={form.targetDate} onChange={(e) => setForm((p) => ({ ...p, targetDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Progress: {form.progress}%</label>
              <input type="range" min="0" max="100" value={form.progress} onChange={(e) => setForm((p) => ({ ...p, progress: e.target.value }))} className="progress-slider" />
            </div>
          </div>

          <div className="form-group">
            <label>Milestones</label>
            <div className="task-add-row">
              <input value={msInput} onChange={(e) => setMsInput(e.target.value)} placeholder="Add a milestone..." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMilestone(); } }} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={addMilestone}><Plus size={13} /></button>
            </div>
            <ul className="task-list" style={{ marginTop: 8 }}>
              {milestones.map((ms) => (
                <li key={ms.id} className="task-item">
                  <input type="checkbox" checked={ms.done} onChange={() => setMilestones((p) => p.map((m) => m.id === ms.id ? { ...m, done: !m.done } : m))} />
                  <span style={{ flex: 1, textDecoration: ms.done ? 'line-through' : 'none', color: ms.done ? 'var(--text-muted)' : 'var(--text-primary)' }}>{ms.text}</span>
                  <button type="button" className="task-remove" style={{ opacity: 1 }} onClick={() => setMilestones((p) => p.filter((m) => m.id !== ms.id))}><Trash2 size={12} /></button>
                </li>
              ))}
            </ul>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const { data: goals, loading, refetch } = useApi(getGoals);
  const [modalOpen, setModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [catFilter, setCatFilter] = useState('all');

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await deleteGoal(id);
      toast.success('Goal deleted');
      refetch();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleToggleMilestone = useCallback(async (goalId, msId) => {
    try {
      await toggleMilestone(goalId, msId);
      refetch();
    } catch {
      toast.error('Failed to update milestone');
    }
  }, [refetch]);

  const handleClose = useCallback(() => { setModalOpen(false); setEditGoal(null); }, []);

  const filtered = (goals || []).filter((g) => catFilter === 'all' || g.category === catFilter);

  return (
    <div>
      <div className="page-header">
        <h1>Goals</h1>
        <button className="btn btn-primary" onClick={() => { setEditGoal(null); setModalOpen(true); }}>
          <Plus size={16} /> New Goal
        </button>
      </div>

      <div className="filter-bar">
        <button className={`filter-btn ${catFilter === 'all' ? 'active' : ''}`} onClick={() => setCatFilter('all')}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`filter-btn ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Target size={48} strokeWidth={1} />
          <h3>No goals yet</h3>
          <p>Set your first goal and break it into milestones.</p>
        </div>
      ) : (
        <div className="goals-grid">
          {filtered.map((goal) => {
            const done = (goal.milestones || []).filter((m) => m.done).length;
            const total = (goal.milestones || []).length;
            const color = catColors[goal.category] || 'var(--text-muted)';
            return (
              <div key={goal._id} className="goal-card" style={{ '--goal-color': color }}>
                <div className="goal-card-header">
                  <div className="goal-cat-badge" style={{ background: `${color}20`, color }}>
                    {goal.category}
                  </div>
                  <div className="goal-card-actions">
                    <button className="card-action-btn" onClick={() => { setEditGoal(goal); setModalOpen(true); }} title="Edit"><Plus size={13} style={{ transform: 'rotate(45deg)' }} /></button>
                    <button className="card-action-btn danger" onClick={() => handleDelete(goal._id)} title="Delete"><Trash2 size={13} /></button>
                  </div>
                </div>

                <h3 className="goal-title">{goal.title}</h3>
                {goal.description && <p className="goal-desc">{goal.description}</p>}

                <div className="goal-progress-row">
                  <div className="progress-bar" style={{ flex: 1 }}>
                    <div className="progress-bar-fill" style={{ width: `${goal.progress}%`, background: color }} />
                  </div>
                  <span className="goal-pct">{goal.progress}%</span>
                </div>

                <div className="goal-meta">
                  <span className={`badge ${statusClass[goal.status] || ''}`}>{goal.status.replace(/-/g, ' ')}</span>
                  {goal.targetDate && (
                    <span className="goal-date">🎯 {format(new Date(goal.targetDate), 'MMM d, yyyy')}</span>
                  )}
                </div>

                {goal.milestones && goal.milestones.length > 0 && (
                  <div className="goal-milestones">
                    <span className="goal-ms-label">{done}/{total} milestones</span>
                    <ul className="goal-ms-list">
                      {goal.milestones.map((ms) => (
                        <li key={ms.id} className={`goal-ms-item ${ms.done ? 'done' : ''}`}>
                          <button
                            className={`goal-ms-check ${ms.done ? 'done' : ''}`}
                            onClick={() => handleToggleMilestone(goal._id, ms.id)}
                          >
                            {ms.done ? <Check size={10} /> : ''}
                          </button>
                          <span>{ms.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && <GoalModal goal={editGoal} onClose={handleClose} onSaved={refetch} />}
    </div>
  );
}
