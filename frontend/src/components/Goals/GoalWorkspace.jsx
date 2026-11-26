/* ─── Goal workspace ───────────────────────────────────────
   Everything that turns a goal from a row into a plan, editable
   in place: sub-goals with steps, dated follow-ups, a progress
   journal, if-then obstacle plans, resources and a measurable
   target. Every change is a PATCH of just the list it touched. */

import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { format, differenceInCalendarDays, isPast, isToday, startOfDay } from 'date-fns';
import {
  Check, Plus, Trash2, CalendarDays, ChevronDown, ChevronRight, Bell, BookMarked,
  Link2, ShieldAlert, Gauge as GaugeIcon, Pencil, Flame, Sparkles, ExternalLink, ListChecks,
  MessageCircle,
} from 'lucide-react';
import { patchGoal } from '../../utils/api';
import { Gauge, TapeDiagram } from '../Charts/ChartKit';

const uid = () => crypto.randomUUID();
const STATUSES = [
  { id: 'not-started', label: 'Not started' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'abandoned', label: 'Dropped' },
];

function dueTone(date, done) {
  if (!date || done) return '';
  const d = new Date(date);
  if (isToday(d)) return 'today';
  if (isPast(d) && d < startOfDay(new Date())) return 'overdue';
  return '';
}

function Section({ icon: Icon, title, count, children, action }) {
  return (
    <section className="gw-section">
      <header>
        <h3><Icon size={15} /> {title} {count != null && <em>{count}</em>}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function AddRow({ placeholder, onAdd, withDate = false, buttonLabel = 'Add' }) {
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim(), date || null);
    setText('');
    setDate('');
  };
  return (
    <form className="gw-add" onSubmit={submit}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={300} />
      {withDate && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />}
      <button type="submit" disabled={!text.trim()}><Plus size={14} /> {buttonLabel}</button>
    </form>
  );
}

export default function GoalWorkspace({ goal, onChange, onEdit, onDelete }) {
  const [openMs, setOpenMs] = useState({});
  const [metricDraft, setMetricDraft] = useState(null);

  const milestones = goal.milestones || [];
  const followUps = goal.followUps || [];
  const checkIns = goal.checkIns || [];
  const resources = goal.resources || [];
  const obstacles = goal.obstacles || [];

  /* Optimistic: show the change now, reconcile with the server's copy
     (which carries the recomputed progress / status / achievements). */
  const save = async (patch, message) => {
    onChange({ ...goal, ...patch }, false);
    try {
      const updated = await patchGoal(goal._id, patch);
      onChange(updated, true);
      if (message) toast.success(message);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save that');
      onChange(goal, true);
    }
  };

  /* ── Sub-goals ──────────────────────────────────────── */
  const setMilestones = (next, msg) => save({ milestones: next }, msg);
  const addMilestone = (text, dueDate) => setMilestones([...milestones, { id: uid(), text, done: false, dueDate, children: [] }]);
  const toggleMs = (id) => setMilestones(milestones.map((m) => {
    if (m.id !== id) return m;
    const done = !m.done;
    return { ...m, done, children: done ? (m.children || []).map((c) => ({ ...c, done: true })) : m.children };
  }), undefined);
  const removeMs = (id) => setMilestones(milestones.filter((m) => m.id !== id));
  const addStep = (msId, text) => setMilestones(milestones.map((m) => (m.id === msId
    ? { ...m, done: false, children: [...(m.children || []), { id: uid(), text, done: false }] } : m)));
  const toggleStep = (msId, sgId) => setMilestones(milestones.map((m) => {
    if (m.id !== msId) return m;
    const children = (m.children || []).map((c) => (c.id === sgId ? { ...c, done: !c.done } : c));
    return { ...m, children, done: children.length > 0 && children.every((c) => c.done) };
  }));
  const removeStep = (msId, sgId) => setMilestones(milestones.map((m) => (m.id === msId
    ? { ...m, children: (m.children || []).filter((c) => c.id !== sgId) } : m)));

  /* ── Follow-ups ─────────────────────────────────────── */
  const sortedFollowUps = useMemo(() => [...followUps].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return new Date(a.dueDate || '2999-01-01') - new Date(b.dueDate || '2999-01-01');
  }), [followUps]);
  const addFollowUp = (text, dueDate) => save({ followUps: [...followUps, { id: uid(), text, dueDate, done: false }] }, 'Follow-up added');
  const toggleFollowUp = (id) => save({ followUps: followUps.map((f) => (f.id === id ? { ...f, done: !f.done, doneAt: !f.done ? new Date().toISOString() : null } : f)) });
  const removeFollowUp = (id) => save({ followUps: followUps.filter((f) => f.id !== id) });

  /* ── Journal ────────────────────────────────────────── */
  const [checkInText, setCheckInText] = useState('');
  const [confidence, setConfidence] = useState(3);
  const addCheckIn = (e) => {
    e.preventDefault();
    if (!checkInText.trim()) return;
    save({ checkIns: [{ id: uid(), text: checkInText.trim(), date: new Date().toISOString(), confidence }, ...checkIns] }, 'Logged — momentum up');
    setCheckInText('');
  };

  /* ── Obstacles / resources ──────────────────────────── */
  const [obstacleDraft, setObstacleDraft] = useState({ obstacle: '', plan: '' });
  const addObstacle = (e) => {
    e.preventDefault();
    if (!obstacleDraft.obstacle.trim()) return;
    save({ obstacles: [...obstacles, { id: uid(), obstacle: obstacleDraft.obstacle.trim(), plan: obstacleDraft.plan.trim() }] });
    setObstacleDraft({ obstacle: '', plan: '' });
  };
  const [resDraft, setResDraft] = useState({ title: '', url: '' });
  const addResource = (e) => {
    e.preventDefault();
    if (!resDraft.title.trim() && !resDraft.url.trim()) return;
    let url = resDraft.url.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    save({ resources: [...resources, { id: uid(), title: resDraft.title.trim() || url, url }] });
    setResDraft({ title: '', url: '' });
  };

  /* ── Metric ─────────────────────────────────────────── */
  const hasMetric = goal.metricTarget != null;
  const metricPct = hasMetric && goal.metricCurrent != null
    ? Math.max(0, Math.min(100, Math.round((((goal.metricCurrent) - (goal.metricStart ?? 0)) / ((goal.metricTarget - (goal.metricStart ?? 0)) || 1)) * 100)))
    : 0;
  const saveMetric = (e) => {
    e.preventDefault();
    save({
      metricLabel: metricDraft.metricLabel,
      metricUnit: metricDraft.metricUnit,
      metricStart: metricDraft.metricStart,
      metricTarget: metricDraft.metricTarget,
      metricCurrent: metricDraft.metricCurrent,
    }, 'Target saved');
    setMetricDraft(null);
  };

  const daysLeft = goal.targetDate ? differenceInCalendarDays(new Date(goal.targetDate), new Date()) : null;
  const msDone = milestones.filter((m) => m.done).length;
  const stepsAll = milestones.flatMap((m) => m.children || []);
  const openFollow = followUps.filter((f) => !f.done);
  const overdueFollow = openFollow.filter((f) => dueTone(f.dueDate) === 'overdue').length;
  const nextAction = sortedFollowUps.find((f) => !f.done)
    || milestones.flatMap((m) => (m.done ? [] : [(m.children || []).find((c) => !c.done) ? { text: (m.children || []).find((c) => !c.done).text } : { text: m.text }]))[0];

  return (
    <div className="gw">
      {/* Hero */}
      <header className="gw-hero" style={{ '--goal-color': 'var(--accent)' }}>
        <span className="gw-icon">{goal.icon || '🎯'}</span>
        <div className="gw-hero-copy">
          <div className="gw-badges">
            <span>{goal.category}</span>
            <span>{goal.horizon || 'season'}</span>
            {typeof daysLeft === 'number' && (
              <span className={daysLeft < 0 ? 'late' : ''}>{daysLeft < 0 ? `${Math.abs(daysLeft)} days late` : `${daysLeft} days left`}</span>
            )}
          </div>
          <h2>{goal.title}</h2>
          {goal.why && <p className="gw-why">“{goal.why}”</p>}
          <div className="gw-status">
            {STATUSES.map((s) => (
              <button key={s.id} type="button" className={goal.status === s.id ? 'active' : ''} onClick={() => goal.status !== s.id && save({ status: s.id })}>{s.label}</button>
            ))}
          </div>
        </div>
        <div className="gw-hero-side">
          <Gauge value={goal.progress || 0} label="progress" height={120} color="var(--accent)" />
          <div className="gw-hero-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}><Pencil size={12} /> Edit</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}><Trash2 size={12} /></button>
          </div>
        </div>
      </header>

      {/* Next action + quick stats */}
      <div className="gw-strip">
        <div className="gw-next">
          <Sparkles size={15} />
          <div>
            <span>Next action</span>
            <strong>{nextAction ? nextAction.text : 'Add a sub-goal or follow-up to get a next step.'}</strong>
          </div>
        </div>
        <div className="gw-mini"><ListChecks size={14} /><strong>{msDone}/{milestones.length}</strong><span>sub-goals</span></div>
        <div className="gw-mini"><Bell size={14} /><strong>{openFollow.length}</strong><span>{overdueFollow ? `${overdueFollow} overdue` : 'follow-ups'}</span></div>
        <div className="gw-mini"><Flame size={14} /><strong>{goal.momentum || 0}</strong><span>momentum</span></div>
      </div>

      <div className="gw-cols">
        <div className="gw-col">
          {/* Sub-goals */}
          <Section icon={ListChecks} title="Sub-goals" count={milestones.length}>
            {milestones.length > 0 && (
              <TapeDiagram rows={[{
                label: 'Breakdown',
                segments: [
                  { name: 'done', value: msDone, color: 'var(--accent-green, #10B981)' },
                  { name: 'open', value: milestones.length - msDone, color: 'var(--chart-2)' },
                  { name: 'steps done', value: stepsAll.filter((s) => s.done).length, color: 'var(--chart-4)' },
                  { name: 'steps open', value: stepsAll.filter((s) => !s.done).length, color: 'var(--chart-3)' },
                ],
              }]} />
            )}
            <ol className="gw-ms">
              {milestones.map((ms, idx) => {
                const kids = ms.children || [];
                const isOpen = openMs[ms.id] ?? !ms.done;
                const tone = dueTone(ms.dueDate, ms.done);
                return (
                  <li key={ms.id} className={ms.done ? 'done' : ''}>
                    <div className="gw-ms-row">
                      <button type="button" className={`gw-check ${ms.done ? 'on' : ''}`} onClick={() => toggleMs(ms.id)} aria-label={ms.done ? 'Mark not done' : 'Mark done'}>
                        {ms.done ? <Check size={12} /> : idx + 1}
                      </button>
                      <button type="button" className="gw-ms-text" onClick={() => setOpenMs((p) => ({ ...p, [ms.id]: !isOpen }))}>
                        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <span>{ms.text}</span>
                        {kids.length > 0 && <em>{kids.filter((k) => k.done).length}/{kids.length}</em>}
                      </button>
                      <label className={`gw-date ${tone}`} title="Due date">
                        <CalendarDays size={12} />
                        <input
                          type="date"
                          value={ms.dueDate ? String(ms.dueDate).slice(0, 10) : ''}
                          onChange={(e) => setMilestones(milestones.map((m) => (m.id === ms.id ? { ...m, dueDate: e.target.value || null } : m)))}
                        />
                      </label>
                      <button type="button" className="gw-del" onClick={() => removeMs(ms.id)} aria-label="Remove sub-goal"><Trash2 size={13} /></button>
                    </div>
                    {isOpen && (
                      <div className="gw-steps">
                        {kids.map((sg) => (
                          <div key={sg.id} className={`gw-step ${sg.done ? 'done' : ''}`}>
                            <button type="button" className={`gw-check gw-check--sm ${sg.done ? 'on' : ''}`} onClick={() => toggleStep(ms.id, sg.id)} aria-label="Toggle step">
                              {sg.done && <Check size={10} />}
                            </button>
                            <span>{sg.text}</span>
                            <button type="button" className="gw-del" onClick={() => removeStep(ms.id, sg.id)} aria-label="Remove step"><Trash2 size={12} /></button>
                          </div>
                        ))}
                        <AddRow placeholder="Add a step…" buttonLabel="Step" onAdd={(text) => addStep(ms.id, text)} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <AddRow placeholder="Add a sub-goal, e.g. “Get B2 German certificate”" withDate buttonLabel="Sub-goal" onAdd={addMilestone} />
          </Section>

          {/* Follow-ups */}
          <Section icon={Bell} title="Follow-ups" count={openFollow.length}>
            <ul className="gw-list">
              {sortedFollowUps.map((f) => {
                const tone = dueTone(f.dueDate, f.done);
                return (
                  <li key={f.id} className={`${f.done ? 'done' : ''} ${tone}`}>
                    <button type="button" className={`gw-check gw-check--sm ${f.done ? 'on' : ''}`} onClick={() => toggleFollowUp(f.id)} aria-label="Toggle follow-up">
                      {f.done && <Check size={10} />}
                    </button>
                    <span className="gw-list-text">{f.text}</span>
                    {f.dueDate && (
                      <span className={`gw-chip ${tone}`}>
                        {tone === 'overdue' ? 'Overdue · ' : tone === 'today' ? 'Today · ' : ''}{format(new Date(f.dueDate), 'd MMM')}
                      </span>
                    )}
                    <button type="button" className="gw-del" onClick={() => removeFollowUp(f.id)} aria-label="Remove"><Trash2 size={12} /></button>
                  </li>
                );
              })}
            </ul>
            <AddRow placeholder="e.g. “Email admissions office about deadline”" withDate buttonLabel="Follow-up" onAdd={addFollowUp} />
          </Section>
        </div>

        <div className="gw-col">
          {/* Metric */}
          <Section
            icon={GaugeIcon}
            title="Measurable target"
            action={!metricDraft && (
              <button type="button" className="gw-link" onClick={() => setMetricDraft({
                metricLabel: goal.metricLabel || '', metricUnit: goal.metricUnit || '',
                metricStart: goal.metricStart ?? '', metricTarget: goal.metricTarget ?? '', metricCurrent: goal.metricCurrent ?? '',
              })}>{hasMetric ? 'Update' : 'Set a target'}</button>
            )}
          >
            {metricDraft ? (
              <form className="gw-metric-form" onSubmit={saveMetric}>
                <input placeholder="What you measure (e.g. Savings, IELTS)" value={metricDraft.metricLabel} onChange={(e) => setMetricDraft((d) => ({ ...d, metricLabel: e.target.value }))} />
                <input placeholder="Unit (€, km, score)" value={metricDraft.metricUnit} onChange={(e) => setMetricDraft((d) => ({ ...d, metricUnit: e.target.value }))} />
                <input type="number" step="any" placeholder="Start" value={metricDraft.metricStart} onChange={(e) => setMetricDraft((d) => ({ ...d, metricStart: e.target.value }))} />
                <input type="number" step="any" placeholder="Now" value={metricDraft.metricCurrent} onChange={(e) => setMetricDraft((d) => ({ ...d, metricCurrent: e.target.value }))} />
                <input type="number" step="any" placeholder="Target" value={metricDraft.metricTarget} onChange={(e) => setMetricDraft((d) => ({ ...d, metricTarget: e.target.value }))} required />
                <div className="gw-metric-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMetricDraft(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Save</button>
                </div>
              </form>
            ) : hasMetric ? (
              <div className="gw-metric">
                <Gauge value={metricPct} label={goal.metricLabel || 'target'} height={130} color="var(--chart-4)" />
                <p>
                  <strong>{goal.metricCurrent ?? '—'}{goal.metricUnit ? ` ${goal.metricUnit}` : ''}</strong> of {goal.metricTarget}{goal.metricUnit ? ` ${goal.metricUnit}` : ''}
                  {goal.metricStart != null && <> · started at {goal.metricStart}</>}
                </p>
              </div>
            ) : (
              <p className="gw-empty">Optional — e.g. “Blocked account: €0 → €11,904” or “German level: A1 → B2”.</p>
            )}
          </Section>

          {/* Journal */}
          <Section icon={BookMarked} title="Progress journal" count={checkIns.length}>
            <form className="gw-journal-form" onSubmit={addCheckIn}>
              <textarea value={checkInText} onChange={(e) => setCheckInText(e.target.value)} placeholder="What moved today? What did you learn?" rows={2} maxLength={1000} />
              <div className="gw-journal-row">
                <span>Confidence</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" className={`gw-conf ${confidence >= n ? 'on' : ''}`} onClick={() => setConfidence(n)} aria-label={`Confidence ${n}`}>●</button>
                ))}
                <button type="submit" className="btn btn-primary btn-sm" disabled={!checkInText.trim()}><MessageCircle size={12} /> Log</button>
              </div>
            </form>
            <ul className="gw-journal">
              {checkIns.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <time>{format(new Date(c.date), 'd MMM')}</time>
                  <p>{c.text}</p>
                  <span className="gw-conf-read">{'●'.repeat(c.confidence || 0)}<i>{'●'.repeat(5 - (c.confidence || 0))}</i></span>
                  <button type="button" className="gw-del" onClick={() => save({ checkIns: checkIns.filter((x) => x.id !== c.id) })} aria-label="Remove entry"><Trash2 size={12} /></button>
                </li>
              ))}
            </ul>
          </Section>

          {/* Obstacles */}
          <Section icon={ShieldAlert} title="Obstacles & if-then plans" count={obstacles.length}>
            <ul className="gw-obstacles">
              {obstacles.map((o) => (
                <li key={o.id}>
                  <div><em>If</em> {o.obstacle}</div>
                  {o.plan && <div><em>Then</em> {o.plan}</div>}
                  <button type="button" className="gw-del" onClick={() => save({ obstacles: obstacles.filter((x) => x.id !== o.id) })} aria-label="Remove"><Trash2 size={12} /></button>
                </li>
              ))}
            </ul>
            <form className="gw-pair" onSubmit={addObstacle}>
              <input placeholder="If… (e.g. visa appointment is booked out)" value={obstacleDraft.obstacle} onChange={(e) => setObstacleDraft((d) => ({ ...d, obstacle: e.target.value }))} />
              <input placeholder="Then I will… (check slots every Monday 8am)" value={obstacleDraft.plan} onChange={(e) => setObstacleDraft((d) => ({ ...d, plan: e.target.value }))} />
              <button type="submit"><Plus size={14} /></button>
            </form>
          </Section>

          {/* Resources */}
          <Section icon={Link2} title="Resources" count={resources.length}>
            <ul className="gw-resources">
              {resources.map((r) => (
                <li key={r.id}>
                  {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title} <ExternalLink size={11} /></a> : <span>{r.title}</span>}
                  <button type="button" className="gw-del" onClick={() => save({ resources: resources.filter((x) => x.id !== r.id) })} aria-label="Remove"><Trash2 size={12} /></button>
                </li>
              ))}
            </ul>
            <form className="gw-pair" onSubmit={addResource}>
              <input placeholder="Title (e.g. DAAD scholarship database)" value={resDraft.title} onChange={(e) => setResDraft((d) => ({ ...d, title: e.target.value }))} />
              <input placeholder="Link" value={resDraft.url} onChange={(e) => setResDraft((d) => ({ ...d, url: e.target.value }))} />
              <button type="submit"><Plus size={14} /></button>
            </form>
          </Section>
        </div>
      </div>
    </div>
  );
}
