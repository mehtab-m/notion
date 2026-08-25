import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, Target, X, Check, Sparkles, Flame, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, differenceInCalendarDays } from 'date-fns';
import useApi from '../hooks/useApi';
import { getGoals, createGoal, updateGoal, deleteGoal, toggleMilestone, toggleSubgoal } from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import './GoalsPage.css';
import useFocusTrap from '../hooks/useFocusTrap';

const CATEGORIES = ['personal', 'work', 'health', 'finance', 'learning', 'other'];
const STATUSES = ['not-started', 'in-progress', 'completed', 'abandoned'];
const HORIZONS = [
  { id: 'sprint', label: 'Sprint (2–4 weeks)' },
  { id: 'season', label: 'Season (quarter)' },
  { id: 'year', label: 'Year' },
  { id: 'lifetime', label: 'Lifetime' },
];
const ICONS = ['🎯', '🚀', '💪', '📚', '💰', '🧠', '❤️', '🌍', '✨', '🏆'];

const catColors = {
  personal: 'var(--accent)',
  work: 'var(--accent-blue)',
  health: 'var(--accent-green)',
  finance: 'var(--accent-yellow)',
  learning: 'var(--chart-4)',
  other: 'var(--text-muted)',
};

function uid() {
  return crypto.randomUUID();
}

function GoalModal({ goal, onClose, onSaved }) {
  /* Traps Tab inside the dialog and stops the page scrolling behind it —
     on a phone the sheet used to slide over a page that kept moving. */
  const cardRef = useFocusTrap(true, { onEscape: onClose, autoFocus: false });
  const isEdit = Boolean(goal);
  const [form, setForm] = useState({
    title: '', description: '', why: '', category: 'personal',
    status: 'not-started', targetDate: '', horizon: 'season', icon: '🎯',
  });
  const [milestones, setMilestones] = useState([]);
  const [msInput, setMsInput] = useState('');
  const [sgDraft, setSgDraft] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (goal) {
      setForm({
        title: goal.title || '',
        description: goal.description || '',
        why: goal.why || '',
        category: goal.category || 'personal',
        status: goal.status || 'not-started',
        targetDate: goal.targetDate ? goal.targetDate.slice(0, 10) : '',
        horizon: goal.horizon || 'season',
        icon: goal.icon || '🎯',
      });
      setMilestones((goal.milestones || []).map((m) => ({
        ...m,
        children: Array.isArray(m.children) ? m.children.map((c) => ({ ...c })) : [],
      })));
    }
  }, [goal]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const addMilestone = () => {
    if (!msInput.trim()) return;
    setMilestones((p) => [...p, { id: uid(), text: msInput.trim(), done: false, children: [] }]);
    setMsInput('');
  };

  const addSubgoal = (msId) => {
    const text = (sgDraft[msId] || '').trim();
    if (!text) return;
    setMilestones((p) => p.map((m) => (
      m.id === msId
        ? { ...m, children: [...(m.children || []), { id: uid(), text, done: false }] }
        : m
    )));
    setSgDraft((d) => ({ ...d, [msId]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        milestones,
        targetDate: form.targetDate || undefined,
      };
      if (isEdit) {
        await updateGoal(goal._id, payload);
        toast.success('Constellation updated');
      } else {
        await createGoal(payload);
        toast.success('North-star goal launched');
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
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        className="modal-card goal-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{isEdit ? 'Edit constellation' : 'New north-star goal'}</h2>
          <button className="modal-close" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Icon</label>
            <div className="emoji-picker">
              {ICONS.map((em) => (
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
            <label>Goal title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="What will change if this succeeds?"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Why it matters (north star)</label>
            <textarea
              value={form.why}
              onChange={(e) => setForm((p) => ({ ...p, why: e.target.value }))}
              placeholder="The deeper reason that keeps you going when motivation dips…"
              rows={2}
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional context"
              rows={2}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Horizon</label>
              <select value={form.horizon} onChange={(e) => setForm((p) => ({ ...p, horizon: e.target.value }))}>
                {HORIZONS.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/-/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Target date</label>
              <input type="date" value={form.targetDate} onChange={(e) => setForm((p) => ({ ...p, targetDate: e.target.value }))} />
            </div>
          </div>

          <div className="form-group">
            <label>Milestones & nested subgoals</label>
            <div className="task-add-row">
              <input
                value={msInput}
                onChange={(e) => setMsInput(e.target.value)}
                placeholder="Add a milestone (key result)…"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMilestone(); } }}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={addMilestone}><Plus size={13} /></button>
            </div>
            <ul className="goal-ms-edit">
              {milestones.map((ms) => (
                <li key={ms.id}>
                  <div className="goal-ms-edit-row">
                    <input
                      type="checkbox"
                      checked={!!ms.done}
                      onChange={() => setMilestones((p) => p.map((m) => m.id === ms.id ? { ...m, done: !m.done } : m))}
                    />
                    <span className={ms.done ? 'done' : ''}>{ms.text}</span>
                    <button type="button" className="task-remove" onClick={() => setMilestones((p) => p.filter((m) => m.id !== ms.id))}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <ul className="goal-sg-edit">
                    {(ms.children || []).map((sg) => (
                      <li key={sg.id}>
                        <input
                          type="checkbox"
                          checked={!!sg.done}
                          onChange={() => setMilestones((p) => p.map((m) => (
                            m.id === ms.id
                              ? { ...m, children: m.children.map((c) => c.id === sg.id ? { ...c, done: !c.done } : c) }
                              : m
                          )))}
                        />
                        <span className={sg.done ? 'done' : ''}>{sg.text}</span>
                        <button
                          type="button"
                          className="task-remove"
                          onClick={() => setMilestones((p) => p.map((m) => (
                            m.id === ms.id
                              ? { ...m, children: m.children.filter((c) => c.id !== sg.id) }
                              : m
                          )))}
                        >
                          <Trash2 size={11} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="task-add-row sg-add">
                    <input
                      value={sgDraft[ms.id] || ''}
                      onChange={(e) => setSgDraft((d) => ({ ...d, [ms.id]: e.target.value }))}
                      placeholder="Add nested subgoal…"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubgoal(ms.id); } }}
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addSubgoal(ms.id)}><Plus size={12} /></button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : isEdit ? 'Update' : 'Launch goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GoalCard({ goal, expanded, onToggleExpand, onEdit, onDelete, onToggleMs, onToggleSg }) {
  const color = catColors[goal.category] || 'var(--text-muted)';
  const milestones = goal.milestones || [];
  const achievements = goal.achievements || [];
  const daysLeft = goal.targetDate
    ? differenceInCalendarDays(new Date(goal.targetDate), new Date())
    : null;

  return (
    <article className={`goal-constellation ${expanded ? 'open' : ''}`} style={{ '--goal-color': color }}>
      <button type="button" className="goal-constellation-top" onClick={onToggleExpand}>
        <span className="goal-icon-orb">{goal.icon || '🎯'}</span>
        <div className="goal-constellation-meta">
          <div className="goal-badges">
            <span className="goal-cat-badge">{goal.category}</span>
            <span className="goal-horizon">{goal.horizon || 'season'}</span>
            {typeof daysLeft === 'number' && (
              <span className={`goal-countdown ${daysLeft < 0 ? 'late' : ''}`}>
                {daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : `${daysLeft}d left`}
              </span>
            )}
          </div>
          <h3>{goal.title}</h3>
          {goal.why && <p className="goal-why">“{goal.why}”</p>}
        </div>
        <div className="goal-ring" title={`${goal.progress}%`}>
          <svg viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="var(--border)"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeDasharray={`${goal.progress || 0}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <span>{goal.progress || 0}%</span>
        </div>
        {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>

      <div className="goal-momentum-bar">
        <Flame size={12} />
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${goal.momentum || 0}%`, background: color }} />
        </div>
        <span>Momentum {goal.momentum || 0}</span>
      </div>

      {achievements.length > 0 && (
        <div className="goal-achievements">
          <Sparkles size={13} />
          {achievements.slice(-4).map((a) => (
            <span key={a.id || a.key} className="goal-ach-pill" title={a.unlockedAt ? format(new Date(a.unlockedAt), 'MMM d') : ''}>
              {a.title}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="goal-constellation-body">
          {goal.description && <p className="goal-desc">{goal.description}</p>}
          <div className="goal-path">
            {milestones.length === 0 && (
              <p className="goal-empty-ms">No milestones yet — edit to add key results & nested wins.</p>
            )}
            {milestones.map((ms, idx) => (
              <div key={ms.id} className={`goal-path-node ${ms.done ? 'done' : ''}`}>
                <div className="goal-path-rail">
                  <button
                    type="button"
                    className={`goal-ms-check ${ms.done ? 'done' : ''}`}
                    onClick={() => onToggleMs(goal._id, ms.id)}
                  >
                    {ms.done ? <Check size={11} /> : idx + 1}
                  </button>
                  {idx < milestones.length - 1 && <span className="goal-path-line" />}
                </div>
                <div className="goal-path-content">
                  <strong className={ms.done ? 'done' : ''}>{ms.text}</strong>
                  {(ms.children || []).length > 0 && (
                    <ul className="goal-subgoal-list">
                      {ms.children.map((sg) => (
                        <li key={sg.id} className={sg.done ? 'done' : ''}>
                          <button
                            type="button"
                            className={`goal-ms-check tiny ${sg.done ? 'done' : ''}`}
                            onClick={() => onToggleSg(goal._id, ms.id, sg.id)}
                          >
                            {sg.done ? <Check size={9} /> : ''}
                          </button>
                          <span>{sg.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="goal-card-actions-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
              <Pencil size={12} /> Edit
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function GoalsPage() {
  const { data: goals, loading, refetch } = useApi(getGoals);
  const [modalOpen, setModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [catFilter, setCatFilter] = useState('all');
  const [deleteId, setDeleteId] = useState(null);
  const [expanded, setExpanded] = useState({});

  const handleDelete = async (id) => {
    try {
      await deleteGoal(id);
      toast.success('Goal removed');
      refetch();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleToggleMilestone = useCallback(async (goalId, msId) => {
    try {
      await toggleMilestone(goalId, msId);
      refetch({ silent: true });
    } catch {
      toast.error('Failed to update milestone');
    }
  }, [refetch]);

  const handleToggleSubgoal = useCallback(async (goalId, msId, sgId) => {
    try {
      await toggleSubgoal(goalId, msId, sgId);
      refetch({ silent: true });
    } catch {
      toast.error('Failed to update subgoal');
    }
  }, [refetch]);

  const handleClose = useCallback(() => { setModalOpen(false); setEditGoal(null); }, []);

  const filtered = (goals || []).filter((g) => catFilter === 'all' || g.category === catFilter);

  const summary = useMemo(() => {
    const list = goals || [];
    const active = list.filter((g) => g.status === 'in-progress').length;
    const done = list.filter((g) => g.status === 'completed').length;
    const avg = list.length
      ? Math.round(list.reduce((s, g) => s + (g.progress || 0), 0) / list.length)
      : 0;
    const ach = list.reduce((n, g) => n + ((g.achievements || []).length), 0);
    return { active, done, avg, ach };
  }, [goals]);

  useEffect(() => {
    if (!goals?.length) return;
    setExpanded((prev) => {
      if (Object.keys(prev).length) return prev;
      return { [goals[0]._id]: true };
    });
  }, [goals]);

  return (
    <div className="goals-lab">
      <div className="page-header">
        <div>
          <h1>Goal Constellation</h1>
          <p className="goals-lede">North-star aims · nested subgoals · micro-achievements · momentum</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setEditGoal(null); setModalOpen(true); }}
        >
          <Plus size={16} /> New goal
        </button>
      </div>

      <div className="goals-summary">
        <div><strong>{summary.active}</strong><span>In orbit</span></div>
        <div><strong>{summary.done}</strong><span>Completed</span></div>
        <div><strong>{summary.avg}%</strong><span>Avg progress</span></div>
        <div><strong>{summary.ach}</strong><span>Achievements</span></div>
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
          <h3>No constellations yet</h3>
          <p>Launch a north-star goal, nest subgoals, and collect achievements as you move.</p>
        </div>
      ) : (
        <div className="goals-constellation-list">
          {filtered.map((goal) => (
            <GoalCard
              key={goal._id}
              goal={goal}
              expanded={!!expanded[goal._id]}
              onToggleExpand={() => setExpanded((p) => ({ ...p, [goal._id]: !p[goal._id] }))}
              onEdit={() => { setEditGoal(goal); setModalOpen(true); }}
              onDelete={() => setDeleteId(goal._id)}
              onToggleMs={handleToggleMilestone}
              onToggleSg={handleToggleSubgoal}
            />
          ))}
        </div>
      )}

      {modalOpen && <GoalModal goal={editGoal} onClose={handleClose} onSaved={refetch} />}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete this constellation?"
        message="The goal, milestones, subgoals, and achievements will be removed."
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
