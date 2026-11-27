import React, { useState } from 'react';
import { Play, Flag, Calendar, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import toast from 'react-hot-toast';
import { updateProjectTask, moveProjectTask } from '../../../utils/api';
import { TASK_STATUSES, TASK_PRIORITIES, taskStatusOf, isUrl } from './config';

export function StatusPill({ status }) {
  const s = TASK_STATUSES.find((x) => x.id === status) || TASK_STATUSES[1];
  return <span className="ws-pill" style={{ '--tone': s.tone }}>{s.label}</span>;
}

export function PriorityFlag({ priority }) {
  const p = TASK_PRIORITIES.find((x) => x.id === priority);
  if (!p || priority === 'medium') return null;
  return <span className="ws-prio" style={{ color: p.tone }} title={`${p.label} priority`}><Flag size={12} /> {p.label}</span>;
}

export function DueChip({ dueAt, done }) {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  const overdue = !done && isPast(d) && !isToday(d);
  return <span className={`ws-due ${overdue ? 'overdue' : ''}`}><Calendar size={11} /> {format(d, 'MMM d')}</span>;
}

/** Inline workflow editor shown under a task row. */
export function TaskDetails({ task, projectId, workspace, onUpdate, onStartSession, docs = [] }) {
  const status = taskStatusOf(task);
  const [draft, setDraft] = useState({
    nextAction: task.nextAction || '', blockerDetails: task.blockerDetails || '', description: task.description || '',
    labels: (task.labels || []).join(', '), externalUrl: task.externalUrl || '',
  });
  const [pendingBlocked, setPendingBlocked] = useState(false);

  const save = async (patch) => {
    try {
      onUpdate(await updateProjectTask(projectId, task.id, patch));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };
  const blurSave = (key, value) => {
    const current = key === 'labels' ? (task.labels || []).join(', ') : (task[key] || '');
    if (value !== current) save({ [key]: value });
  };
  const linkedDocs = docs.filter((d) => (d.taskIds || []).includes(task.id));

  return (
    <div className="ws-task-details">
      <div className="ws-form-grid">
        <div className="ws-field">
          <label>Status</label>
          <select value={pendingBlocked ? 'blocked' : status} onChange={(e) => {
            if (e.target.value === 'blocked' && !draft.blockerDetails.trim()) { setPendingBlocked(true); return; }
            setPendingBlocked(false);
            save({ status: e.target.value, blockerDetails: draft.blockerDetails });
          }}>
            {TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="ws-field">
          <label>Priority</label>
          <select value={task.priority || 'medium'} onChange={(e) => save({ priority: e.target.value })}>
            {TASK_PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div className="ws-field">
          <label>Due</label>
          <input type="date" value={task.dueAt ? task.dueAt.slice(0, 10) : ''} onChange={(e) => save({ dueAt: e.target.value || null })} />
        </div>
        <div className="ws-field">
          <label>Repository</label>
          <select value={task.repositoryId || ''} onChange={(e) => save({ repositoryId: e.target.value || null })}>
            <option value="">None</option>
            {(workspace?.repositories || []).map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
          </select>
        </div>
        {(status === 'blocked' || pendingBlocked) && (
          <div className="ws-field wide">
            <label><AlertTriangle size={12} /> What is blocking it? *</label>
            <div className="ws-row">
              <input value={draft.blockerDetails} autoFocus={pendingBlocked} onChange={(e) => setDraft((p) => ({ ...p, blockerDetails: e.target.value }))}
                onBlur={() => !pendingBlocked && blurSave('blockerDetails', draft.blockerDetails)}
                placeholder="Waiting on API keys from client" />
              {pendingBlocked && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                  if (!draft.blockerDetails.trim()) { toast.error('Describe the blocker'); return; }
                  setPendingBlocked(false);
                  save({ status: 'blocked', blockerDetails: draft.blockerDetails });
                }}>Mark blocked</button>
              )}
            </div>
          </div>
        )}
        <div className="ws-field wide">
          <label>Next action</label>
          <input value={draft.nextAction} onChange={(e) => setDraft((p) => ({ ...p, nextAction: e.target.value }))}
            onBlur={() => blurSave('nextAction', draft.nextAction)} placeholder="The very next physical step" />
        </div>
        <div className="ws-field">
          <label>Labels</label>
          <input value={draft.labels} onChange={(e) => setDraft((p) => ({ ...p, labels: e.target.value }))}
            onBlur={() => blurSave('labels', draft.labels)} placeholder="bug, api" />
        </div>
        <div className="ws-field">
          <label>Issue / PR link</label>
          <input value={draft.externalUrl} onChange={(e) => setDraft((p) => ({ ...p, externalUrl: e.target.value }))}
            onBlur={() => blurSave('externalUrl', draft.externalUrl)} placeholder="https://github.com/…/issues/12" />
        </div>
        <div className="ws-field wide">
          <label>Description</label>
          <textarea rows={3} value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
            onBlur={() => blurSave('description', draft.description)} />
        </div>
      </div>
      <div className="ws-task-foot">
        {isUrl(task.externalUrl) && <a className="ws-chip" href={task.externalUrl} target="_blank" rel="noreferrer"><ExternalLink size={11} /> Issue</a>}
        {linkedDocs.map((d) => <span key={d._id} className="ws-chip"><FileText size={11} /> {d.title}</span>)}
        {task.completedAt && <span className="ws-muted">Completed {format(new Date(task.completedAt), 'MMM d, h:mm a')}</span>}
        {status !== 'done' && onStartSession && (
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => onStartSession(task.id)}>
            <Play size={13} /> Start session
          </button>
        )}
      </div>
    </div>
  );
}

/** Kanban board over the six workflow statuses, HTML5 drag-and-drop. */
export function TaskBoard({ tasks, projectId, team, onUpdate, onOpenTask }) {
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [blockAsk, setBlockAsk] = useState(null); // { taskId, beforeId }
  const [reason, setReason] = useState('');
  const visible = tasks.filter((t) => !t.archivedAt);

  const move = async (taskId, status, beforeId, blockerDetails) => {
    try {
      onUpdate(await moveProjectTask(projectId, taskId, { status, beforeId, blockerDetails }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not move task');
    }
  };

  const drop = (status, beforeId) => {
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    if (!id || id === beforeId) return;
    const task = tasks.find((t) => t.id === id);
    if (status === 'blocked' && taskStatusOf(task) !== 'blocked' && !task.blockerDetails) {
      setBlockAsk({ taskId: id, beforeId });
      setReason('');
      return;
    }
    move(id, status, beforeId);
  };

  return (
    <div className="ws-board">
      {TASK_STATUSES.map((col) => {
        const items = visible.filter((t) => taskStatusOf(t) === col.id);
        return (
          <div key={col.id} className={`ws-col ${overCol === col.id ? 'over' : ''}`} style={{ '--tone': col.tone }}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
            onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
            onDrop={(e) => { e.preventDefault(); drop(col.id); }}>
            <div className="ws-col-head"><span className="ws-col-dot" />{col.label}<span className="pd-nav-count">{items.length}</span></div>
            {col.id === 'blocked' && blockAsk && (
              <div className="ws-block-ask">
                <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What is blocking it?"
                  onKeyDown={(e) => { if (e.key === 'Enter' && reason.trim()) { move(blockAsk.taskId, 'blocked', blockAsk.beforeId, reason.trim()); setBlockAsk(null); } }} />
                <div className="ws-form-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBlockAsk(null)}>Cancel</button>
                  <button type="button" className="btn btn-primary btn-sm" disabled={!reason.trim()} onClick={() => { move(blockAsk.taskId, 'blocked', blockAsk.beforeId, reason.trim()); setBlockAsk(null); }}>Block</button>
                </div>
              </div>
            )}
            {items.map((t) => (
              <div key={t.id} className={`ws-bcard ${dragId === t.id ? 'dragging' : ''}`} draggable
                onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDragId(null); setOverCol(null); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(col.id, t.id); }}
                onClick={() => onOpenTask?.(t.id)}>
                <strong>{t.text}</strong>
                {t.nextAction && col.id !== 'done' && <em>→ {t.nextAction}</em>}
                {col.id === 'blocked' && t.blockerDetails && <em className="ws-blocker">⛔ {t.blockerDetails}</em>}
                <div className="ws-bcard-meta">
                  <PriorityFlag priority={t.priority} />
                  <DueChip dueAt={t.dueAt} done={col.id === 'done'} />
                  {(t.labels || []).slice(0, 2).map((l) => <span key={l} className="ws-chip">{l}</span>)}
                  {t.assignee && team.length > 1 && <span className="ws-avatar" title={t.assignee}>{t.assignee.charAt(0).toUpperCase()}</span>}
                  {(t.subtasks || []).length > 0 && <span className="ws-muted">{t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}</span>}
                </div>
                <select className="ws-bcard-move" value={col.id} onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const to = e.target.value;
                    if (to === 'blocked' && !t.blockerDetails) { setBlockAsk({ taskId: t.id }); setReason(''); } else move(t.id, to);
                  }}
                  aria-label="Move to">
                  {TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            ))}
            {items.length === 0 && <div className="ws-col-empty">Drop here</div>}
          </div>
        );
      })}
    </div>
  );
}
