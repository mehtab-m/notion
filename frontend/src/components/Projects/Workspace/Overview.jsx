import React, { useState } from 'react';
import { LayoutDashboard, ExternalLink, AlertTriangle, Activity, Layers, Timer, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import ResourcePanel from './ResourcePanel';
import { HandoffView } from './SessionPanel';
import { StatusPill, PriorityFlag, DueChip } from './Tasks';
import { taskStatusOf, formatDuration, isUrl, looksSecret } from './config';

function Stat({ label, value, tone, onClick }) {
  return (
    <button type="button" className="ws-stat" style={tone ? { '--tone': tone } : undefined} onClick={onClick} disabled={!onClick}>
      <strong>{value}</strong><span>{label}</span>
    </button>
  );
}

export function OverviewPanel({ project, projectId, workspace, canEdit, saveField, onChanged, goTab, openTask }) {
  const tasks = (project.tasks || []).filter((t) => !t.archivedAt);
  const by = (s) => tasks.filter((t) => taskStatusOf(t) === s);
  const open = tasks.filter((t) => taskStatusOf(t) !== 'done');
  const seconds = (workspace.sessions || []).reduce((n, s) => n + (s.seconds || 0), 0);
  const lastHandoff = (workspace.sessions || []).find((s) => s.status === 'completed' && s.handoff);
  const nextActions = open.filter((t) => t.nextAction && taskStatusOf(t) !== 'blocked').slice(0, 6);
  const [links, setLinks] = useState({ projectUrl: project.projectUrl || '', documentationUrl: project.documentationUrl || '', notes: project.notes || '' });
  const blur = (k) => { if (links[k] !== (project[k] || '')) saveField({ [k]: links[k] }); };

  return (
    <div className="ws-overview">
      <section className="pd-section">
        <div className="pd-panel-title"><LayoutDashboard size={16} /><h3>At a glance</h3></div>
        <div className="ws-stats">
          <Stat label="Open tasks" value={open.length} onClick={() => goTab('tasks')} />
          <Stat label="In progress" value={by('in_progress').length} tone="var(--accent)" onClick={() => goTab('board')} />
          <Stat label="Blocked" value={by('blocked').length} tone="var(--accent-red, #EF4444)" onClick={() => goTab('board')} />
          <Stat label="In review" value={by('review').length} tone="var(--accent-yellow, #F59E0B)" onClick={() => goTab('board')} />
          <Stat label="Repositories" value={(workspace.repositories || []).length} onClick={() => goTab('repos')} />
          <Stat label="Environments" value={(workspace.environments || []).length} onClick={() => goTab('envs')} />
          <Stat label="Docs" value={(workspace.documents || []).filter((d) => !d.archivedAt).length} onClick={() => goTab('docs')} />
          <Stat label="Time logged" value={formatDuration(seconds)} onClick={() => goTab('sessions')} />
        </div>
      </section>

      <div className="ws-overview-grid">
        <section className="pd-section">
          <div className="pd-panel-title ws-title"><ArrowRight size={16} /><h3>Next actions</h3></div>
          {nextActions.length === 0 ? <p className="ws-muted">Give open tasks a “next action” to see them here.</p> : (
            <ul className="ws-next">
              {nextActions.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => openTask(t.id)}>
                    <span>{t.nextAction}</span>
                    <em>{t.text}</em>
                  </button>
                  <div className="ws-chips"><StatusPill status={taskStatusOf(t)} /><PriorityFlag priority={t.priority} /><DueChip dueAt={t.dueAt} /></div>
                </li>
              ))}
            </ul>
          )}
          {by('blocked').length > 0 && (
            <>
              <h4 className="ws-h4"><AlertTriangle size={13} /> Blocked</h4>
              <ul className="ws-next">
                {by('blocked').map((t) => (
                  <li key={t.id}><button type="button" onClick={() => openTask(t.id)}><span>{t.text}</span><em className="ws-blocker">{t.blockerDetails}</em></button></li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="pd-section">
          <div className="pd-panel-title ws-title"><Timer size={16} /><h3>Latest handoff</h3></div>
          {lastHandoff ? (
            <>
              <p className="ws-muted">{lastHandoff.taskTitle || 'Project work'} · {formatDistanceToNow(new Date(lastHandoff.endedAt || lastHandoff.startedAt), { addSuffix: true })}</p>
              <HandoffView handoff={lastHandoff.handoff} />
            </>
          ) : <p className="ws-muted">Finish a work session with a handoff and it shows up here, so you know exactly where to pick up.</p>}
        </section>
      </div>

      <section className="pd-section">
        <div className="pd-panel-title"><ExternalLink size={16} /><h3>Project links & notes</h3></div>
        <div className="ws-form-grid">
          {['projectUrl', 'documentationUrl'].map((k) => (
            <div key={k} className="ws-field">
              <label>{k === 'projectUrl' ? 'Live / project URL' : 'Documentation URL'}</label>
              <div className="ws-row">
                <input value={links[k]} disabled={!canEdit} onChange={(e) => setLinks((p) => ({ ...p, [k]: e.target.value }))} onBlur={() => blur(k)} placeholder="https://" />
                {isUrl(project[k]) && <a className="pd-icon-btn" href={project[k]} target="_blank" rel="noreferrer"><ExternalLink size={13} /></a>}
              </div>
            </div>
          ))}
          <div className="ws-field wide">
            <label>Notes</label>
            <textarea rows={3} value={links.notes} disabled={!canEdit} onChange={(e) => setLinks((p) => ({ ...p, notes: e.target.value }))} onBlur={() => blur('notes')} />
          </div>
        </div>
        {looksSecret(links.notes) && <div className="ws-secret-warn"><AlertTriangle size={14} /> Notes look like they contain a secret value.</div>}
      </section>

      <ResourcePanel projectId={projectId} kind="technologies" workspace={workspace} canEdit={canEdit} onChanged={onChanged} icon={Layers} />

      <section className="pd-section">
        <div className="pd-panel-title ws-title">
          <Activity size={16} /><h3>Recent activity</h3>
          <div className="ws-title-actions"><button type="button" className="ws-link-btn" onClick={() => goTab('activity')}>All activity <ArrowRight size={12} /></button></div>
        </div>
        <ActivityList items={(workspace.activity || []).slice(0, 6)} />
      </section>
    </div>
  );
}

function dayLabel(d) {
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE, MMM d');
}

const TYPE_TONE = {
  task: 'var(--accent)', session: 'var(--accent-green, #10B981)', project: '#8b5cf6',
  repository: '#0ea5e9', environment: '#f97316', service: '#ec4899', document: '#14b8a6', command: '#64748b', technology: '#a855f7',
};

export function ActivityList({ items }) {
  if (!items.length) return <p className="ws-muted">Nothing yet.</p>;
  let lastDay = '';
  return (
    <ul className="ws-activity">
      {items.map((a) => {
        const d = new Date(a.createdAt);
        const day = dayLabel(d);
        const showDay = day !== lastDay;
        lastDay = day;
        const kind = String(a.type || '').split('.')[0];
        return (
          <React.Fragment key={a._id}>
            {showDay && <li className="ws-activity-day">{day}</li>}
            <li className="ws-activity-row">
              <span className="ws-activity-dot" style={{ background: TYPE_TONE[kind] || 'var(--text-muted)' }} />
              <span className="ws-activity-text">{a.summary}</span>
              <span className="ws-muted">{a.userName ? `${a.userName} · ` : ''}{format(d, 'h:mm a')}</span>
            </li>
          </React.Fragment>
        );
      })}
    </ul>
  );
}

export function ActivityPanel({ workspace }) {
  const [kind, setKind] = useState('all');
  const items = workspace.activity || [];
  const kinds = ['all', ...new Set(items.map((a) => String(a.type).split('.')[0]))];
  const visible = kind === 'all' ? items : items.filter((a) => String(a.type).startsWith(`${kind}.`));
  return (
    <section className="pd-section">
      <div className="pd-panel-title"><Activity size={16} /><h3>Activity</h3></div>
      <div className="pd-table-presets">
        {kinds.map((k) => <button key={k} type="button" className={`filter-btn ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>{k}</button>)}
      </div>
      <ActivityList items={visible} />
    </section>
  );
}
