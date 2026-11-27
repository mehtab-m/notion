import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Building2, User, Briefcase, Users as Handshake, GraduationCap, GitBranch,
  Code2, Palette, Megaphone, FlaskConical, PenTool, Settings2, CalendarHeart, Shapes,
  ArrowLeft, ArrowRight, Check, AlertCircle, PartyPopper, Flag, CircleDot, PauseCircle, Clock3,
} from 'lucide-react';
import { createProject } from '../../utils/api';
import './ProjectModal.css';
import useFocusTrap from '../../hooks/useFocusTrap';

export const ACCOUNT_TYPES = [
  { id: 'company', label: 'Company', hint: 'Work for your employer', icon: Building2, orgLabel: 'Company name' },
  { id: 'personal', label: 'Personal', hint: 'Your own side project', icon: User, orgLabel: null },
  { id: 'freelance', label: 'Freelance', hint: 'Paid gig, your own business', icon: Briefcase, orgLabel: 'Business / brand' },
  { id: 'client', label: 'Client', hint: 'Delivered for a client', icon: Handshake, orgLabel: 'Client name' },
  { id: 'study', label: 'Study', hint: 'School, course or research', icon: GraduationCap, orgLabel: 'School / course' },
  { id: 'open-source', label: 'Open source', hint: 'Public, community work', icon: GitBranch, orgLabel: 'Organisation / repo' },
];

export const PROJECT_TYPES = [
  { id: 'software', label: 'Software', icon: Code2 },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'research', label: 'Research', icon: FlaskConical },
  { id: 'content', label: 'Content', icon: PenTool },
  { id: 'operations', label: 'Operations', icon: Settings2 },
  { id: 'event', label: 'Event', icon: CalendarHeart },
  { id: 'other', label: 'Other', icon: Shapes },
];

const PRIORITIES = [
  { id: 'low', label: 'Low', hint: 'Nice to have, no rush', tone: 'var(--accent-green, #10B981)' },
  { id: 'medium', label: 'Medium', hint: 'Important, normal pace', tone: 'var(--accent-yellow, #F59E0B)' },
  { id: 'high', label: 'High', hint: 'Urgent, top of the list', tone: 'var(--accent-red, #EF4444)' },
];

const STATUSES = [
  { id: 'planned', label: 'Planned', hint: "Haven't started yet", icon: Clock3 },
  { id: 'active', label: 'In progress', hint: 'Working on it now', icon: CircleDot },
  { id: 'on-hold', label: 'On hold', hint: 'Paused for a while', icon: PauseCircle },
];

const COLORS = ['#4F46E5', '#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6'];

const defaultForm = {
  title: '',
  description: '',
  accountType: '',
  organization: '',
  projectType: '',
  role: '',
  priority: 'medium',
  status: 'active',
  startDate: '',
  dueDate: '',
  budget: '',
  color: COLORS[0],
};

/** Map a server field name to the step that edits it. */
const FIELD_STEP = { title: 'name', dueDate: 'end', startDate: 'start', budget: 'budget' };

export default function ProjectModal({ onClose, onSaved, onCreated }) {
  const cardRef = useFocusTrap(true, { onEscape: onClose, autoFocus: false });
  const [form, setForm] = useState(defaultForm);
  const [stepIndex, setStepIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const inputRef = useRef(null);

  const account = ACCOUNT_TYPES.find((a) => a.id === form.accountType);

  /* The org/role step only exists for account types that have an org. */
  const steps = useMemo(() => [
    'name', 'who', ...(account?.orgLabel ? ['details'] : []),
    'type', 'about', 'start', 'end', 'budget', 'priority', 'status', 'color',
  ], [account?.orgLabel]);

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex === steps.length - 1;

  const set = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 260);
    return () => clearTimeout(t);
  }, [step, created]);

  /** Returns an error message for the current step, or ''. */
  const validate = (s = step) => {
    if (s === 'name' && !form.title.trim()) return 'Give your project a name to continue.';
    if (s === 'who' && !form.accountType) return 'Pick who this project is for.';
    if (s === 'type' && !form.projectType) return 'Pick the kind of project.';
    if (s === 'end' && form.startDate && form.dueDate && form.dueDate < form.startDate) {
      return 'The end date is before the start date. Pick a later day.';
    }
    if (s === 'budget' && form.budget !== '' && (!Number.isFinite(Number(form.budget)) || Number(form.budget) < 0)) {
      return 'Budget must be a positive number (or leave it empty).';
    }
    return '';
  };

  const go = (delta) => {
    setDir(delta);
    setError('');
    setStepIndex((i) => Math.max(0, Math.min(steps.length - 1, i + delta)));
  };

  const next = () => {
    const msg = validate();
    if (msg) { setError(msg); return; }
    if (isLast) submit();
    else go(1);
  };

  /* Choosing an option moves on by itself — one tap per question. */
  const choose = (name, value) => {
    set(name, value);
    setTimeout(() => { setDir(1); setStepIndex((i) => i + 1); }, 180);
  };

  const submit = async () => {
    for (const s of steps) {
      const msg = validate(s);
      if (msg) { setDir(-1); setStepIndex(steps.indexOf(s)); setError(msg); return; }
    }
    setLoading(true);
    setError('');
    try {
      const saved = await createProject({
        title: form.title.trim(),
        description: form.description.trim(),
        accountType: form.accountType || 'personal',
        organization: account?.orgLabel ? form.organization.trim() : '',
        projectType: form.projectType || 'other',
        role: account?.orgLabel ? form.role.trim() : '',
        priority: form.priority,
        status: form.status,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        budget: form.budget === '' ? null : Number(form.budget),
        color: form.color,
        tasks: [],
        dataTables: [],
      });
      setCreated(saved);
      onSaved?.();
    } catch (err) {
      const data = err.response?.data || {};
      let msg = data.error || data.message;
      if (!msg) {
        if (err.code === 'ECONNABORTED') msg = 'The server took too long to answer. Try again.';
        else if (!err.response) msg = "Can't reach the server. Is the backend running?";
        else if (err.response.status === 403) msg = 'Projects are only available for developer accounts.';
        else if (err.response.status === 402) msg = 'Your plan limit is reached. Upgrade to add more projects.';
        else msg = `Could not create the project (error ${err.response.status}).`;
      }
      const target = FIELD_STEP[data.field];
      if (target && steps.includes(target)) { setDir(-1); setStepIndex(steps.indexOf(target)); }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && !created) {
      e.preventDefault();
      next();
    }
  };

  const optional = ['about', 'start', 'end', 'budget'].includes(step);
  const progress = created ? 100 : Math.round((stepIndex / steps.length) * 100);

  const renderStep = () => {
    switch (step) {
      case 'name':
        return (
          <Q title="What's the project called?" hint="A short name you'll recognise later.">
            <input
              ref={inputRef}
              className="pw-big-input"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Mobile app redesign"
              maxLength={200}
            />
          </Q>
        );
      case 'who':
        return (
          <Q title="Who is this for?" hint="Tap one.">
            <div className="pw-choices">
              {ACCOUNT_TYPES.map(({ id, label, hint, icon: Icon }) => (
                <button key={id} type="button" className={`pw-choice ${form.accountType === id ? 'active' : ''}`} onClick={() => choose('accountType', id)}>
                  <Icon size={18} />
                  <span><strong>{label}</strong><em>{hint}</em></span>
                </button>
              ))}
            </div>
          </Q>
        );
      case 'details':
        return (
          <Q title={`A few details about the ${account.label.toLowerCase()}`} hint="Both are optional.">
            <label className="pw-label">{account.orgLabel}</label>
            <input ref={inputRef} className="pw-input" value={form.organization} onChange={(e) => set('organization', e.target.value)} placeholder={account.orgLabel} maxLength={160} />
            <label className="pw-label">Your role</label>
            <input className="pw-input" value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="e.g. Lead developer" maxLength={120} />
          </Q>
        );
      case 'type':
        return (
          <Q title="What kind of project is it?" hint="Tap one.">
            <div className="pw-choices pw-choices--4">
              {PROJECT_TYPES.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" className={`pw-choice pw-choice--tile ${form.projectType === id ? 'active' : ''}`} onClick={() => choose('projectType', id)}>
                  <Icon size={20} />
                  <strong>{label}</strong>
                </button>
              ))}
            </div>
          </Q>
        );
      case 'about':
        return (
          <Q title="What is it about?" hint="Optional — the goal, or what 'done' looks like.">
            <textarea ref={inputRef} className="pw-input" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Launch the new checkout by March" maxLength={5000} />
          </Q>
        );
      case 'start':
        return (
          <Q title="When does it start?" hint="Optional. Skip if you're not sure.">
            <input ref={inputRef} type="date" className="pw-input pw-date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            <div className="pw-quick">
              <button type="button" onClick={() => set('startDate', new Date().toISOString().slice(0, 10))}>Today</button>
              {form.startDate && <button type="button" onClick={() => set('startDate', '')}>Clear</button>}
            </div>
          </Q>
        );
      case 'end':
        return (
          <Q title="When should it be finished?" hint="Optional. This is your deadline.">
            <input ref={inputRef} type="date" className="pw-input pw-date" min={form.startDate || undefined} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            <div className="pw-quick">
              {[7, 30, 90].map((d) => (
                <button key={d} type="button" onClick={() => {
                  const base = form.startDate ? new Date(form.startDate) : new Date();
                  base.setDate(base.getDate() + d);
                  set('dueDate', base.toISOString().slice(0, 10));
                }}>
                  In {d === 7 ? '1 week' : d === 30 ? '1 month' : '3 months'}
                </button>
              ))}
              {form.dueDate && <button type="button" onClick={() => set('dueDate', '')}>Clear</button>}
            </div>
          </Q>
        );
      case 'budget':
        return (
          <Q title="Is there a budget?" hint="Optional. Just the amount, numbers only.">
            <input ref={inputRef} type="number" min="0" step="0.01" inputMode="decimal" className="pw-big-input" value={form.budget} onChange={(e) => set('budget', e.target.value)} placeholder="0" />
          </Q>
        );
      case 'priority':
        return (
          <Q title="How important is it?" hint="Tap one.">
            <div className="pw-choices pw-choices--3">
              {PRIORITIES.map((p) => (
                <button key={p.id} type="button" style={{ '--tone': p.tone }} className={`pw-choice pw-choice--tile pw-tone ${form.priority === p.id ? 'active' : ''}`} onClick={() => choose('priority', p.id)}>
                  <Flag size={20} />
                  <strong>{p.label}</strong>
                  <em>{p.hint}</em>
                </button>
              ))}
            </div>
          </Q>
        );
      case 'status':
        return (
          <Q title="Where is it right now?" hint="Tap one.">
            <div className="pw-choices pw-choices--3">
              {STATUSES.map(({ id, label, hint, icon: Icon }) => (
                <button key={id} type="button" className={`pw-choice pw-choice--tile ${form.status === id ? 'active' : ''}`} onClick={() => choose('status', id)}>
                  <Icon size={20} />
                  <strong>{label}</strong>
                  <em>{hint}</em>
                </button>
              ))}
            </div>
          </Q>
        );
      case 'color':
        return (
          <Q title="Pick a colour for its folder" hint="Then create your project.">
            <div className="pw-colors">
              {COLORS.map((c) => (
                <button key={c} type="button" className={`pw-color ${form.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => set('color', c)} aria-label={`Colour ${c}`}>
                  {form.color === c && <Check size={16} strokeWidth={3} />}
                </button>
              ))}
            </div>
            <div className="pw-preview" style={{ '--folder': form.color }}>
              <span className="pw-preview-tab" />
              <div className="pw-preview-body">
                <strong>{form.title || 'Your project'}</strong>
                <em>{PROJECT_TYPES.find((t) => t.id === form.projectType)?.label || 'Project'} · {STATUSES.find((s) => s.id === form.status)?.label}</em>
              </div>
            </div>
          </Q>
        );
      default:
        return null;
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="New project"
        className="modal-card pw-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="pw-top">
          <span className="pw-count">{created ? 'Done' : `Step ${stepIndex + 1} of ${steps.length}`}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="pw-progress"><span style={{ width: `${progress}%` }} /></div>

        {created ? (
          <div className="pw-step pw-success" key="done">
            <span className="pw-success-icon" style={{ background: form.color }}><PartyPopper size={28} /></span>
            <h2>“{created.title}” is ready</h2>
            <p>Your project folder has been created. Add tasks, files and teammates inside it.</p>
            <div className="pw-actions pw-actions--center">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Back to projects</button>
              <button
                ref={inputRef}
                type="button"
                className="btn btn-primary"
                onClick={() => (onCreated ? onCreated(created) : onClose())}
              >
                Open project <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`pw-step ${dir > 0 ? 'from-right' : 'from-left'}`} key={step}>
              {renderStep()}
            </div>

            {error && (
              <div className="pw-error" role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="pw-actions">
              <button type="button" className="btn btn-secondary" onClick={() => go(-1)} disabled={stepIndex === 0 || loading}>
                <ArrowLeft size={15} /> Back
              </button>
              <div className="pw-actions-right">
                {optional && !isLast && (
                  <button type="button" className="pw-skip" onClick={() => go(1)}>Skip</button>
                )}
                <button type="button" className="btn btn-primary" onClick={next} disabled={loading}>
                  {loading ? 'Creating…' : isLast ? <>Create project <Check size={15} /></> : <>Next <ArrowRight size={15} /></>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function Q({ title, hint, children }) {
  return (
    <div className="pw-q">
      <h2>{title}</h2>
      {hint && <p>{hint}</p>}
      <div className="pw-q-body">{children}</div>
    </div>
  );
}
