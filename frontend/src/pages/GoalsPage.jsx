import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Target, X, Search, Bell, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { differenceInCalendarDays, startOfDay, addDays } from 'date-fns';
import { getGoals, createGoal, updateGoal, deleteGoal } from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import GoalWorkspace from '../components/Goals/GoalWorkspace';
import { ChartCard, ChartGrid, ConcentricRings, DonutChart, TapeDiagram } from '../components/Charts/ChartKit';
import './GoalsPage.css';
import useFocusTrap from '../hooks/useFocusTrap';

/* Starter plans: picking one pre-fills sub-goals, steps, follow-ups and a
   target so a goal like "Study in Germany" starts as a usable plan. */
const iso = (days) => startOfDay(addDays(new Date(), days)).toISOString().slice(0, 10);
const TEMPLATES = [
  {
    id: 'study-abroad', label: 'Study abroad', icon: '🌍', category: 'learning', horizon: 'year',
    title: 'Study in Germany', why: 'A world-class degree and a new life abroad.',
    milestones: [
      ['Shortlist universities & programmes', ['Search DAAD database', 'Compare 5 programmes', 'Check admission requirements']],
      ['Language certificate', ['Pick test (IELTS / TestDaF)', 'Book exam date', 'Daily practice 45 min']],
      ['Documents ready', ['Transcripts & degree attested', 'CV (Europass)', 'Motivation letter', '2 recommendation letters']],
      ['Apply (uni-assist / direct)', ['Submit applications', 'Pay fees']],
      ['Finances & blocked account', ['Open blocked account', 'Health insurance']],
      ['Student visa', ['Book embassy appointment', 'Prepare visa file']],
      ['Housing & travel', ['Apply for student dorm', 'Book flight']],
    ],
    followUps: [['Email admissions office about intake deadlines', 7], ['Book language test', 14]],
    obstacles: [['Visa appointment slots are booked out', 'Check the portal every Monday morning and join the waitlist']],
    metric: { metricLabel: 'Blocked account', metricUnit: '€', metricStart: 0, metricTarget: 11904 },
  },
  {
    id: 'fitness', label: 'Get fit', icon: '💪', category: 'health', horizon: 'season',
    title: 'Run a 10K', why: 'Feel strong and energetic every day.',
    milestones: [
      ['Build a base', ['Run 3× a week for 2 weeks', 'Buy proper running shoes']],
      ['Run 5K without stopping', []],
      ['Run 8K', []],
      ['Race day 10K', ['Register for a race', 'Taper week']],
    ],
    followUps: [["Plan this week's 3 runs", 1]],
    obstacles: [['It rains', 'Do a 30-minute indoor session instead']],
    metric: { metricLabel: 'Longest run', metricUnit: 'km', metricStart: 0, metricTarget: 10 },
  },
  {
    id: 'career', label: 'Career move', icon: '🚀', category: 'work', horizon: 'season',
    title: 'Land a new role', why: 'Grow faster and do work I am proud of.',
    milestones: [
      ['Define target roles & companies', ['List 20 companies']],
      ['Portfolio & CV refreshed', ['Update CV', 'Update LinkedIn', 'Ship 1 portfolio project']],
      ['Applications', ['Apply to 5 roles / week']],
      ['Interview prep', ['Practice 10 mock interviews']],
      ['Offer & negotiation', []],
    ],
    followUps: [['Message 3 people for referrals', 3]],
    obstacles: [],
    metric: { metricLabel: 'Applications sent', metricUnit: '', metricStart: 0, metricTarget: 40 },
  },
  {
    id: 'save', label: 'Save money', icon: '💰', category: 'finance', horizon: 'year',
    title: 'Build an emergency fund', why: 'Sleep well knowing I can handle surprises.',
    milestones: [
      ['Track spending for a month', []],
      ['Set up automatic transfer', []],
      ['Reach 1 month of expenses', []],
      ['Reach 3 months of expenses', []],
    ],
    followUps: [['Review subscriptions and cancel unused ones', 5]],
    obstacles: [['Unexpected big purchase', 'Pause, wait 48 hours, then decide']],
    metric: { metricLabel: 'Saved', metricUnit: '', metricStart: 0, metricTarget: 3000 },
  },
];

function buildFromTemplate(t) {
  return {
    form: {
      title: t.title, description: '', why: t.why, category: t.category,
      status: 'not-started', targetDate: '', horizon: t.horizon, icon: t.icon,
    },
    milestones: t.milestones.map(([text, steps]) => ({
      id: crypto.randomUUID(),
      text,
      done: false,
      children: steps.map((st) => ({ id: crypto.randomUUID(), text: st, done: false })),
    })),
    extra: {
      followUps: t.followUps.map(([text, days]) => ({ id: crypto.randomUUID(), text, dueDate: iso(days), done: false })),
      obstacles: t.obstacles.map(([obstacle, plan]) => ({ id: crypto.randomUUID(), obstacle, plan })),
      ...t.metric,
    },
  };
}

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
  const [extra, setExtra] = useState({});
  const [msInput, setMsInput] = useState('');

  const applyTemplate = (t) => {
    const built = buildFromTemplate(t);
    setForm(built.form);
    setMilestones(built.milestones);
    setExtra(built.extra);
  };
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
    let saved = null;
    try {
      const payload = {
        ...(isEdit ? {} : extra),
        ...form,
        milestones,
        targetDate: form.targetDate || undefined,
      };
      if (isEdit) {
        saved = await updateGoal(goal._id, payload);
        toast.success('Goal updated');
      } else {
        saved = await createGoal(payload);
        toast.success('Goal created — now plan it out');
      }
      onSaved(saved);
      onClose();
    } catch {
      toast.error('Failed to save goal');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        className="modal-card goal-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{isEdit ? 'Edit goal' : 'New goal'}</h2>
          <button className="modal-close" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        {!isEdit && (
          <div className="goal-templates">
            <span><Wand2 size={13} /> Start from a plan:</span>
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className="goal-template-btn" onClick={() => applyTemplate(t)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}
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
            <label>Sub-goals &amp; steps <span className="goal-label-hint">(follow-ups, journal and targets live on the goal page)</span></label>
            <div className="task-add-row">
              <input
                value={msInput}
                onChange={(e) => setMsInput(e.target.value)}
                placeholder="Add a sub-goal…"
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
                      placeholder="Add a step…"
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
    </div>,
    document.body
  );
}


function goalAlerts(goal) {
  const today = startOfDay(new Date());
  const overdue = (goal.followUps || []).filter((f) => !f.done && f.dueDate && new Date(f.dueDate) < today).length
    + (goal.milestones || []).filter((m) => !m.done && m.dueDate && new Date(m.dueDate) < today).length;
  return overdue;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [catFilter, setCatFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [searchParams] = useSearchParams();

  const load = useCallback(async () => {
    try {
      const list = await getGoals();
      setGoals(list);
      return list;
    } catch {
      toast.error('Could not load goals');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!goals?.length) return;
    const wanted = searchParams.get('goal');
    if (wanted && goals.some((g) => g._id === wanted)) { setSelectedId(wanted); return; }
    setSelectedId((cur) => (cur && goals.some((g) => g._id === cur) ? cur : goals[0]._id));
  }, [goals, searchParams]);

  const handleDelete = async (id) => {
    try {
      await deleteGoal(id);
      toast.success('Goal moved to trash');
      setGoals((prev) => prev.filter((g) => g._id !== id));
      setSelectedId(null);
    } catch {
      toast.error('Failed to delete');
    }
  };

  const replaceGoal = useCallback((updated) => {
    setGoals((prev) => prev.map((g) => (g._id === updated._id ? updated : g)));
  }, []);

  const handleClose = useCallback(() => { setModalOpen(false); setEditGoal(null); }, []);
  const handleSaved = async (saved) => {
    await load();
    if (saved?._id) setSelectedId(saved._id);
  };

  const list = goals || [];
  const filtered = list.filter((g) => (catFilter === 'all' || g.category === catFilter)
    && (!query || g.title.toLowerCase().includes(query.toLowerCase())));
  const selected = list.find((g) => g._id === selectedId) || null;

  const summary = useMemo(() => {
    const active = list.filter((g) => g.status === 'in-progress').length;
    const done = list.filter((g) => g.status === 'completed').length;
    const avg = list.length ? Math.round(list.reduce((s, g) => s + (g.progress || 0), 0) / list.length) : 0;
    const follow = list.reduce((n, g) => n + (g.followUps || []).filter((f) => !f.done).length, 0);
    const overdue = list.reduce((n, g) => n + goalAlerts(g), 0);
    return { active, done, avg, follow, overdue };
  }, [list]);

  const rings = useMemo(() => list.filter((g) => g.status !== 'abandoned').slice(0, 6)
    .map((g) => ({ name: `${g.icon || ''} ${g.title.length > 16 ? `${g.title.slice(0, 16)}…` : g.title}`, value: g.progress || 0 })), [list]);
  const byCat = useMemo(() => {
    const m = {};
    list.forEach((g) => { m[g.category] = (m[g.category] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [list]);
  const statusTape = useMemo(() => [{
    label: 'Status',
    segments: ['not-started', 'in-progress', 'completed', 'abandoned'].map((s) => ({
      name: s.replace('-', ' '), value: list.filter((g) => g.status === s).length,
    })),
  }, {
    label: 'Follow-ups',
    segments: [
      { name: 'overdue', value: summary.overdue, color: 'var(--accent-red, #EF4444)' },
      { name: 'open', value: Math.max(0, summary.follow - summary.overdue), color: 'var(--chart-2)' },
      { name: 'done', value: list.reduce((n, g) => n + (g.followUps || []).filter((f) => f.done).length, 0), color: 'var(--accent-green, #10B981)' },
    ],
  }], [list, summary]);

  return (
    <div className="goals-lab">
      <div className="page-header">
        <div>
          <h1>Goals</h1>
          <p className="goals-lede">Break big goals into sub-goals, follow-ups and a journal — so every goal has a next step.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditGoal(null); setModalOpen(true); }}>
          <Plus size={16} /> New goal
        </button>
      </div>

      <div className="goals-summary">
        <div><strong>{summary.active}</strong><span>In progress</span></div>
        <div><strong>{summary.done}</strong><span>Completed</span></div>
        <div><strong>{summary.avg}%</strong><span>Avg progress</span></div>
        <div className={summary.overdue ? 'is-alert' : ''}><strong>{summary.follow}</strong><span>{summary.overdue ? `${summary.overdue} overdue` : 'Open follow-ups'}</span></div>
      </div>

      {list.length > 0 && (
        <ChartGrid cols={3}>
          <ChartCard title="Goal rings" subtitle="Progress of each goal">
            <ConcentricRings data={rings} height={220} />
          </ChartCard>
          <ChartCard title="By category" subtitle="Where your goals live">
            <DonutChart data={byCat} height={220} centerLabel="goals" />
          </ChartCard>
          <ChartCard title="Pipeline" subtitle="Status and follow-ups">
            <TapeDiagram rows={statusTape} />
          </ChartCard>
        </ChartGrid>
      )}

      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <Target size={48} strokeWidth={1} />
          <h3>No goals yet</h3>
          <p>Create one — or start from a plan like “Study abroad” to get sub-goals and follow-ups pre-filled.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => { setEditGoal(null); setModalOpen(true); }}>
            <Plus size={14} /> New goal
          </button>
        </div>
      ) : (
        <div className="goals-split">
          <aside className="goals-rail">
            <div className="goals-rail-search">
              <Search size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a goal…" />
            </div>
            <div className="goals-rail-cats">
              <button className={catFilter === 'all' ? 'active' : ''} onClick={() => setCatFilter('all')}>All</button>
              {CATEGORIES.map((c) => (
                <button key={c} className={catFilter === c ? 'active' : ''} onClick={() => setCatFilter(c)}>{c}</button>
              ))}
            </div>
            <ul className="goals-rail-list">
              {filtered.map((g) => {
                const alerts = goalAlerts(g);
                const days = g.targetDate ? differenceInCalendarDays(new Date(g.targetDate), new Date()) : null;
                return (
                  <li key={g._id}>
                    <button
                      type="button"
                      className={`goals-rail-item ${g._id === selectedId ? 'active' : ''} st-${g.status}`}
                      style={{ '--goal-color': catColors[g.category] || 'var(--accent)' }}
                      onClick={() => setSelectedId(g._id)}
                    >
                      <span className="goals-rail-icon">{g.icon || '🎯'}</span>
                      <span className="goals-rail-copy">
                        <strong>{g.title}</strong>
                        <em>
                          {(g.milestones || []).filter((m) => m.done).length}/{(g.milestones || []).length} sub-goals
                          {days != null && ` · ${days < 0 ? `${-days}d late` : `${days}d left`}`}
                        </em>
                        <span className="goals-rail-bar"><i style={{ width: `${g.progress || 0}%` }} /></span>
                      </span>
                      {alerts > 0 && <span className="goals-rail-alert" title={`${alerts} overdue`}><Bell size={11} /> {alerts}</span>}
                      <span className="goals-rail-pct">{g.progress || 0}%</span>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && <li className="goals-rail-empty">No goals match.</li>}
            </ul>
          </aside>

          <div className="goals-detail">
            {selected ? (
              <GoalWorkspace
                key={selected._id}
                goal={selected}
                onChange={replaceGoal}
                onEdit={() => { setEditGoal(selected); setModalOpen(true); }}
                onDelete={() => setDeleteId(selected._id)}
              />
            ) : (
              <div className="empty-state"><Target size={40} strokeWidth={1} /><h3>Pick a goal</h3></div>
            )}
          </div>
        </div>
      )}

      {modalOpen && <GoalModal goal={editGoal} onClose={handleClose} onSaved={handleSaved} />}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete this goal?"
        message="The goal and its sub-goals, follow-ups and journal go to the trash."
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
