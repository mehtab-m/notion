import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Timer, Play, Pause, Square, GitBranch, ChevronDown, ChevronRight, Trash2, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  getActiveWorkSession, startWorkSession, updateWorkSession, pauseWorkSession,
  resumeWorkSession, completeWorkSession, deleteWorkSession,
} from '../../../utils/api';
import { TASK_STATUSES, taskStatusOf, formatDuration } from './config';

/** Live seconds for a session object returned by the API (seconds at fetch + running delta). */
export function useLiveSeconds(session) {
  const [now, setNow] = useState(Date.now());
  const [base] = useState(() => ({ at: Date.now() }));
  useEffect(() => {
    if (session?.status !== 'active') return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session?.status]);
  if (!session) return 0;
  const fetchedAt = session._fetchedAt || base.at;
  return (session.seconds || 0) + (session.status === 'active' ? Math.max(0, (now - fetchedAt) / 1000) : 0);
}

const stamp = (s) => (s ? { ...s, _fetchedAt: Date.now() } : s);

const EMPTY_HANDOFF = { completedSummary: '', currentState: '', remainingWork: '', nextAction: '', blockers: '', technicalNotes: '', links: [] };

function HandoffForm({ session, onCancel, onDone }) {
  const [h, setH] = useState(EMPTY_HANDOFF);
  const [taskStatus, setTaskStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setH((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (taskStatus === 'blocked' && !h.blockers.trim()) { toast.error('Describe the blocker to mark it blocked'); return; }
    setSaving(true);
    try {
      const done = await completeWorkSession(session.projectId, session._id, { handoff: h, taskStatus: taskStatus || undefined });
      toast.success('Session finished');
      onDone(done);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not finish');
    } finally { setSaving(false); }
  };

  const area = (k, label, ph, rows = 2) => (
    <div className="ws-field wide"><label>{label}</label><textarea rows={rows} value={h[k]} placeholder={ph} onChange={(e) => set(k, e.target.value)} /></div>
  );

  return (
    <div className="ws-form">
      <p className="ws-hint">Leave a handoff for future you — what's done, where you stopped, what's next.</p>
      <div className="ws-form-grid">
        {area('completedSummary', 'What got done', 'Wired the invite email…')}
        {area('currentState', 'Current state', 'Branch compiles, tests red on…')}
        {area('remainingWork', 'Remaining work', '')}
        <div className="ws-field wide"><label>Next action</label><input value={h.nextAction} onChange={(e) => set('nextAction', e.target.value)} placeholder="Fix the failing invite test" /></div>
        {area('blockers', 'Blockers', '')}
        {area('technicalNotes', 'Technical notes', 'Gotchas, commands, decisions…', 3)}
        <div className="ws-field wide">
          <label>Links</label>
          <div className="ws-rows">
            {h.links.map((l, i) => (
              <div key={i} className="ws-row">
                <input value={l.label} placeholder="PR #42" onChange={(e) => set('links', h.links.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} />
                <input value={l.url} placeholder="https://…" onChange={(e) => set('links', h.links.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)))} />
                <button type="button" className="pd-icon-btn danger" onClick={() => set('links', h.links.filter((_, idx) => idx !== i))}><X size={13} /></button>
              </div>
            ))}
            <button type="button" className="ws-link-btn" onClick={() => set('links', [...h.links, { label: '', url: '' }])}><Plus size={13} /> Add link</button>
          </div>
        </div>
        {session.taskId && (
          <div className="ws-field">
            <label>Move task to</label>
            <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)}>
              <option value="">Keep current status</option>
              {TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="ws-form-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Back</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={saving}><Square size={13} /> {saving ? 'Finishing…' : 'Finish session'}</button>
      </div>
    </div>
  );
}

export function HandoffView({ handoff }) {
  if (!handoff) return null;
  const rows = [
    ['Done', handoff.completedSummary], ['State', handoff.currentState], ['Remaining', handoff.remainingWork],
    ['Next', handoff.nextAction], ['Blockers', handoff.blockers], ['Notes', handoff.technicalNotes],
  ].filter(([, v]) => v);
  return (
    <div className="ws-kv">
      {rows.map(([k, v]) => (
        <div key={k} className="ws-kv-row"><span className="ws-kv-label">{k}</span><div className="ws-kv-value" style={{ whiteSpace: 'pre-wrap' }}>{v}</div></div>
      ))}
      {(handoff.links || []).length > 0 && (
        <div className="ws-kv-row"><span className="ws-kv-label">Links</span>
          <div className="ws-kv-value ws-chips">{handoff.links.map((l, i) => <a key={i} className="ws-chip" href={l.url} target="_blank" rel="noreferrer">{l.label || l.url}</a>)}</div>
        </div>
      )}
    </div>
  );
}

function ActiveCard({ session, here, workspace, onUpdate, onFinish }) {
  const seconds = useLiveSeconds(session);
  const [branch, setBranch] = useState(session.branchName || '');
  const [notes, setNotes] = useState(session.notes || '');
  const [busy, setBusy] = useState(false);

  const act = async (fn) => {
    setBusy(true);
    try { onUpdate(stamp(await fn(session.projectId, session._id))); } catch (err) { toast.error(err.response?.data?.error || 'Failed'); } finally { setBusy(false); }
  };
  const saveDetails = async () => {
    if (branch === (session.branchName || '') && notes === (session.notes || '')) return;
    try { onUpdate(stamp(await updateWorkSession(session.projectId, session._id, { branchName: branch, notes }))); } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  return (
    <div className={`ws-session-live ${session.status}`}>
      <div className="ws-session-top">
        <div>
          <span className="ws-muted">{session.status === 'active' ? 'Working on' : 'Paused'}{!here && session.project ? ` · ${session.project.title}` : ''}</span>
          <strong>{session.taskTitle || 'Project work'}</strong>
        </div>
        <span className="ws-session-clock">{formatDuration(seconds)}</span>
      </div>
      {here ? (
        <>
          <div className="ws-form-grid">
            <div className="ws-field"><label><GitBranch size={12} /> Branch</label><input className="ws-mono" value={branch} onChange={(e) => setBranch(e.target.value)} onBlur={saveDetails} placeholder="feature/invite-flow" /></div>
            <div className="ws-field">
              <label>Repository</label>
              <select value={session.repositoryId || ''} onChange={async (e) => onUpdate(stamp(await updateWorkSession(session.projectId, session._id, { repositoryId: e.target.value || null })))}>
                <option value="">None</option>
                {(workspace.repositories || []).map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
              </select>
            </div>
            <div className="ws-field wide"><label>Scratch notes</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveDetails} /></div>
          </div>
          <div className="ws-form-actions">
            {session.status === 'active'
              ? <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(pauseWorkSession)}><Pause size={13} /> Pause</button>
              : <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(resumeWorkSession)}><Play size={13} /> Resume</button>}
            <button type="button" className="btn btn-primary btn-sm" onClick={onFinish}><Square size={13} /> Finish + handoff</button>
          </div>
        </>
      ) : (
        <div className="ws-form-actions">
          <Link className="btn btn-secondary btn-sm" to={`/projects/${session.projectId}?tab=sessions`}>Open that project</Link>
        </div>
      )}
    </div>
  );
}

export default function SessionPanel({ projectId, project, workspace, preselectTaskId, onChanged, onProjectRefresh }) {
  const [active, setActive] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [taskId, setTaskId] = useState(preselectTaskId || '');
  const [repoId, setRepoId] = useState('');
  const [branch, setBranch] = useState('');
  const [open, setOpen] = useState({});
  const sessions = workspace.sessions || [];
  const openTasks = (project.tasks || []).filter((t) => taskStatusOf(t) !== 'done' && !t.archivedAt);

  const loadActive = useCallback(async () => {
    try { setActive(stamp(await getActiveWorkSession())); } catch { /* silent */ }
  }, []);
  useEffect(() => { loadActive(); }, [loadActive]);
  useEffect(() => { if (preselectTaskId) setTaskId(preselectTaskId); }, [preselectTaskId]);

  const upsertHistory = (s) => {
    const rest = sessions.filter((x) => x._id !== s._id);
    onChanged('sessions', [s, ...rest]);
  };

  const start = async () => {
    try {
      const s = stamp(await startWorkSession(projectId, { taskId: taskId || undefined, repositoryId: repoId || undefined, branchName: branch }));
      setActive(s);
      upsertHistory(s);
      setBranch('');
      onProjectRefresh?.();
      toast.success('Session started');
    } catch (err) { toast.error(err.response?.data?.error || 'Could not start'); }
  };

  const here = active && active.projectId === projectId;

  return (
    <section className="pd-section">
      <div className="pd-panel-title"><Timer size={16} /><h3>Work sessions</h3></div>

      {active && !finishing && (
        <ActiveCard session={active} here={here} workspace={workspace}
          onUpdate={(s) => { setActive(s); if (s.projectId === projectId) upsertHistory(s); }}
          onFinish={() => setFinishing(true)} />
      )}
      {active && finishing && here && (
        <HandoffForm session={active} onCancel={() => setFinishing(false)}
          onDone={(s) => { setFinishing(false); setActive(null); upsertHistory(s); onProjectRefresh?.(); }} />
      )}

      {(!active || !here) && (
        <div className="ws-form">
          <p className="ws-hint">{active ? 'Starting here pauses the session that is running elsewhere.' : 'Track focused time on a task. Pausing is safe — time is kept in segments.'}</p>
          <div className="ws-form-grid">
            <div className="ws-field wide">
              <label>Task</label>
              <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">General project work</option>
                {openTasks.map((t) => <option key={t.id} value={t.id}>{t.text}</option>)}
              </select>
            </div>
            <div className="ws-field">
              <label>Repository</label>
              <select value={repoId} onChange={(e) => setRepoId(e.target.value)}>
                <option value="">None</option>
                {(workspace.repositories || []).map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
              </select>
            </div>
            <div className="ws-field"><label>Branch</label><input className="ws-mono" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="feature/…" /></div>
          </div>
          <div className="ws-form-actions"><button type="button" className="btn btn-primary btn-sm" onClick={start}><Play size={13} /> Start session</button></div>
        </div>
      )}

      <h4 className="ws-h4">History</h4>
      {sessions.filter((s) => s.status === 'completed').length === 0 ? (
        <div className="pd-empty ws-empty"><p>No finished sessions yet</p></div>
      ) : (
        <div className="ws-list">
          {sessions.filter((s) => s.status === 'completed').map((s) => {
            const expanded = !!open[s._id];
            return (
              <article key={s._id} className="ws-card">
                <header className="ws-card-head">
                  <button type="button" className="ws-expand" onClick={() => setOpen((p) => ({ ...p, [s._id]: !expanded }))}>
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <strong>{s.taskTitle || 'Project work'}</strong>
                  </button>
                  <div className="ws-chips">
                    <span className="ws-chip">{formatDuration(s.seconds)}</span>
                    {s.branchName && <span className="ws-chip ws-mono">{s.branchName}</span>}
                    {s.handoff && <span className="ws-chip ws-chip-accent">handoff</span>}
                    <span className="ws-muted">{format(new Date(s.startedAt), 'MMM d, h:mm a')}</span>
                  </div>
                  <div className="ws-card-actions">
                    <button type="button" className="pd-icon-btn danger" title="Delete" onClick={async () => {
                      try { await deleteWorkSession(projectId, s._id); onChanged('sessions', sessions.filter((x) => x._id !== s._id)); } catch { toast.error('Failed'); }
                    }}><Trash2 size={13} /></button>
                  </div>
                </header>
                {expanded && (
                  <>
                    {s.notes && <p className="ws-summary" style={{ whiteSpace: 'pre-wrap' }}>{s.notes}</p>}
                    <HandoffView handoff={s.handoff} />
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
