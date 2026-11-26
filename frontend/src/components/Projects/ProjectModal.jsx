import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Building2, User, Briefcase, Handshake, GraduationCap, GitBranch,
  Code2, Palette, Megaphone, FlaskConical, PenTool, Settings2, CalendarHeart, Shapes,
} from 'lucide-react';
import toast from 'react-hot-toast';
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

const COLORS = ['#4F46E5', '#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6'];

const defaultForm = {
  title: '',
  description: '',
  accountType: 'personal',
  organization: '',
  projectType: 'software',
  role: '',
  priority: 'medium',
  status: 'active',
  startDate: '',
  dueDate: '',
  budget: '',
  tags: '',
  color: COLORS[0],
};

export default function ProjectModal({ onClose, onSaved, onCreated }) {
  const cardRef = useFocusTrap(true, { onEscape: onClose, autoFocus: false });
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));
  const handleChange = (e) => set(e.target.name, e.target.value);

  const account = ACCOUNT_TYPES.find((a) => a.id === form.accountType);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Project name is required'); return; }
    if (form.startDate && form.dueDate && form.dueDate < form.startDate) {
      toast.error('Deadline is before the start date');
      return;
    }
    setLoading(true);
    try {
      const created = await createProject({
        title: form.title.trim(),
        description: form.description.trim(),
        accountType: form.accountType,
        organization: account?.orgLabel ? form.organization.trim() : '',
        projectType: form.projectType,
        role: form.role.trim(),
        priority: form.priority,
        status: form.status,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        budget: form.budget === '' ? null : Number(form.budget),
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        color: form.color,
        tasks: [],
        dataTables: [],
      });
      toast.success('Project created!');
      onSaved?.();
      if (onCreated) onCreated(created);
      else onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  /* Portalled to <body>: the projects page animates in with a transform,
     and a transformed ancestor turns `position: fixed` into "fixed to that
     box", which pushed the dialog off-screen so the button looked dead. */
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-title"
        className="modal-card project-modal-card pm-rich"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="pm-title">New project</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="pm-form">
          <div className="form-group">
            <label htmlFor="pm-name">Project name *</label>
            <input id="pm-name" name="title" value={form.title} onChange={handleChange} placeholder="e.g. Mobile app redesign" autoFocus maxLength={200} />
          </div>

          <fieldset className="pm-fieldset">
            <legend>Who is this for?</legend>
            <div className="pm-choice-grid">
              {ACCOUNT_TYPES.map(({ id, label, hint, icon: Icon }) => (
                <button key={id} type="button" className={`pm-choice ${form.accountType === id ? 'active' : ''}`} onClick={() => set('accountType', id)} aria-pressed={form.accountType === id}>
                  <Icon size={17} />
                  <strong>{label}</strong>
                  <em>{hint}</em>
                </button>
              ))}
            </div>
          </fieldset>

          {account?.orgLabel && (
            <div className="pm-row">
              <div className="form-group">
                <label htmlFor="pm-org">{account.orgLabel}</label>
                <input id="pm-org" name="organization" value={form.organization} onChange={handleChange} placeholder={account.orgLabel} maxLength={160} />
              </div>
              <div className="form-group">
                <label htmlFor="pm-role">Your role</label>
                <input id="pm-role" name="role" value={form.role} onChange={handleChange} placeholder="e.g. Lead developer" maxLength={120} />
              </div>
            </div>
          )}

          <fieldset className="pm-fieldset">
            <legend>Type of project</legend>
            <div className="pm-type-row">
              {PROJECT_TYPES.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" className={`pm-type ${form.projectType === id ? 'active' : ''}`} onClick={() => set('projectType', id)} aria-pressed={form.projectType === id}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="form-group">
            <label htmlFor="pm-desc">What is it about?</label>
            <textarea id="pm-desc" name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Goal, scope, definition of done…" maxLength={5000} />
          </div>

          <div className="pm-row pm-row--3">
            <div className="form-group">
              <label htmlFor="pm-start">Start</label>
              <input id="pm-start" type="date" name="startDate" value={form.startDate} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="pm-due">Deadline</label>
              <input id="pm-due" type="date" name="dueDate" value={form.dueDate} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="pm-budget">Budget</label>
              <input id="pm-budget" type="number" min="0" step="0.01" name="budget" value={form.budget} onChange={handleChange} placeholder="optional" />
            </div>
          </div>

          <div className="pm-row">
            <div className="form-group">
              <label>Priority</label>
              <div className="pm-seg">
                {['low', 'medium', 'high'].map((p) => (
                  <button key={p} type="button" className={`pm-seg-btn pri-${p} ${form.priority === p ? 'active' : ''}`} onClick={() => set('priority', p)}>{p}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Status</label>
              <div className="pm-seg">
                {['planned', 'active', 'on-hold'].map((s) => (
                  <button key={s} type="button" className={`pm-seg-btn ${form.status === s ? 'active' : ''}`} onClick={() => set('status', s)}>{s.replace('-', ' ')}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="pm-row">
            <div className="form-group">
              <label htmlFor="pm-tags">Tags</label>
              <input id="pm-tags" name="tags" value={form.tags} onChange={handleChange} placeholder="comma, separated" />
            </div>
            <div className="form-group">
              <label>Colour</label>
              <div className="pm-colors">
                {COLORS.map((c) => (
                  <button key={c} type="button" className={`pm-color ${form.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => set('color', c)} aria-label={`Colour ${c}`} />
                ))}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
