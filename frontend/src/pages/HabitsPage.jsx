import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Flame, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import useApi from '../hooks/useApi';
import useMediaQuery, { MOBILE_QUERY } from '../hooks/useMediaQuery';
import { getHabits, createHabit, deleteHabit, toggleHabitDate } from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import './HabitsPage.css';

const EMOJIS = ['✅', '💪', '📚', '🏃', '💧', '🧘', '🥗', '😴', '✍️', '🎯', '🎸', '🌱'];

function HabitModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', icon: '✅', frequency: 'daily' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setLoading(true);
    try {
      await createHabit(form);
      toast.success('Habit created!');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to create habit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Habit</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Read 30 minutes, Exercise..."
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Icon</label>
            <div className="emoji-picker">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className={`emoji-btn ${form.icon === em ? 'selected' : ''}`}
                  onClick={() => setForm((p) => ({ ...p, icon: em }))}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Frequency</label>
            <select
              value={form.frequency}
              onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional notes..."
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HabitsPage() {
  const { data: habits, loading, setData, refetch } = useApi(getHabits);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const today = format(new Date(), 'yyyy-MM-dd');
  const dayCount = isMobile ? 6 : 13;
  const days = eachDayOfInterval({ start: subDays(new Date(), dayCount), end: new Date() });

  const handleToggle = useCallback(async (habitId, date) => {
    setData((prev) => (prev || []).map((h) => {
      if (h._id !== habitId) return h;
      const dates = [...(h.completedDates || [])];
      const idx = dates.indexOf(date);
      if (idx >= 0) dates.splice(idx, 1);
      else dates.push(date);
      return { ...h, completedDates: dates };
    }));

    try {
      const updated = await toggleHabitDate(habitId, date);
      setData((prev) => (prev || []).map((h) => (h._id === habitId ? updated : h)));
    } catch {
      toast.error('Failed to update habit');
      refetch({ silent: true });
    }
  }, [setData, refetch]);

  const handleDelete = async (id) => {
    setData((prev) => (prev || []).filter((h) => h._id !== id));
    try {
      await deleteHabit(id);
      toast.success('Habit deleted');
    } catch {
      toast.error('Failed to delete');
      refetch({ silent: true });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Habit Tracker</h1>
          {isMobile && (
            <p className="habits-mobile-hint">Showing last 7 days</p>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New Habit
        </button>
      </div>

      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : !habits || habits.length === 0 ? (
        <div className="empty-state">
          <Flame size={48} strokeWidth={1} />
          <h3>No habits yet</h3>
          <p>Start building habits to track your progress daily.</p>
        </div>
      ) : (
        <div className="habits-table-wrap">
          <table className="habits-table">
            <thead>
              <tr>
                <th className="habit-name-th">Habit</th>
                {days.map((d) => (
                  <th
                    key={d.toISOString()}
                    className={`habit-day-th ${format(d, 'yyyy-MM-dd') === today ? 'today' : ''}`}
                  >
                    <div className="habit-day-label">
                      <span>{format(d, 'EEE')}</span>
                      <span>{format(d, 'd')}</span>
                    </div>
                  </th>
                ))}
                <th className="habit-streak-th">Streak</th>
                <th className="habit-actions-th" />
              </tr>
            </thead>
            <tbody>
              {habits.map((habit) => (
                <tr key={habit._id} className="habit-row">
                  <td className="habit-name-cell">
                    <span className="habit-icon">{habit.icon}</span>
                    <div className="habit-info">
                      <span className="habit-name">{habit.name}</span>
                      {habit.description && (
                        <span className="habit-desc">{habit.description}</span>
                      )}
                    </div>
                  </td>
                  {days.map((d) => {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const done = (habit.completedDates || []).includes(dateStr);
                    const isFuture = dateStr > today;
                    return (
                      <td key={dateStr} className="habit-day-cell">
                        <button
                          className={`habit-dot ${done ? 'done' : ''} ${isFuture ? 'future' : ''}`}
                          onClick={() => !isFuture && handleToggle(habit._id, dateStr)}
                          disabled={isFuture}
                          title={dateStr}
                        >
                          {done ? '✓' : ''}
                        </button>
                      </td>
                    );
                  })}
                  <td className="habit-streak-cell">
                    <div className="streak-badge">
                      <Flame size={13} color="var(--accent-yellow)" />
                      <span>{habit.streak}</span>
                    </div>
                  </td>
                  <td className="habit-actions-cell">
                    <button
                      className="card-action-btn danger"
                      onClick={() => setDeleteId(habit._id)}
                      title="Delete habit"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <HabitModal
          onClose={() => setModalOpen(false)}
          onSaved={() => refetch({ silent: true })}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete habit?"
        message="This habit and all its tracking history will be permanently removed."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          const id = deleteId;
          setDeleteId(null);
          handleDelete(id);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
