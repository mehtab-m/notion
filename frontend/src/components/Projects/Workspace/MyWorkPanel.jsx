import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Timer } from 'lucide-react';
import { getMyWork } from '../../../utils/api';
import { useLiveSeconds } from './SessionPanel';
import { PriorityFlag, DueChip } from './Tasks';
import { formatDuration } from './config';
import './Workspace.css';

const KEY = 'sortlife.myWork.open';

function Item({ task, sub }) {
  return (
    <Link className="mw-item" style={{ '--folder': task.project?.color || undefined }} to={`/projects/${task.project?._id || task.project?.id}?tab=tasks`}>
      <strong>{sub || task.text}</strong>
      <em>{sub ? `${task.text} · ` : ''}{task.project?.title}</em>
      <div className="ws-chips"><PriorityFlag priority={task.priority} /><DueChip dueAt={task.dueAt} /></div>
    </Link>
  );
}

function LiveSession({ session }) {
  const seconds = useLiveSeconds(session);
  return (
    <Link className="mw-item" style={{ '--folder': 'var(--accent-green, #10B981)' }} to={`/projects/${session.projectId}?tab=sessions`}>
      <strong><Timer size={12} /> {session.taskTitle || 'Project work'} · {formatDuration(seconds)}</strong>
      <em>{session.status === 'paused' ? 'Paused · ' : ''}{session.project?.title}</em>
    </Link>
  );
}

/** Cross-project "what should I do now" strip for the Projects page. */
export default function MyWorkPanel() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(() => localStorage.getItem(KEY) !== '0');

  useEffect(() => {
    getMyWork().then((d) => setData(d && { ...d, activeSession: d.activeSession && { ...d.activeSession, _fetchedAt: Date.now() } })).catch(() => {});
  }, []);

  if (!data) return null;
  const { counts } = data;
  const toggle = () => { localStorage.setItem(KEY, open ? '0' : '1'); setOpen(!open); };

  return (
    <section className="mw-panel">
      <button type="button" className="mw-head" onClick={toggle}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3>My work</h3>
        <span className="mw-counts">
          <span className="ws-chip">{counts.open} open</span>
          {counts.inProgress > 0 && <span className="ws-chip ws-chip-accent">{counts.inProgress} in progress</span>}
          {counts.blocked > 0 && <span className="ws-chip ws-chip-danger">{counts.blocked} blocked</span>}
          {counts.review > 0 && <span className="ws-chip">{counts.review} in review</span>}
          {counts.overdue > 0 && <span className="ws-chip ws-chip-danger">{counts.overdue} overdue</span>}
        </span>
      </button>
      {open && (
        <div className="mw-grid">
          <div className="mw-col">
            <h4>Now</h4>
            {data.activeSession && <LiveSession session={data.activeSession} />}
            {data.inProgress.slice(0, 5).map((t) => <Item key={t.id} task={t} />)}
            {!data.activeSession && !data.inProgress.length && <p className="ws-muted">Nothing in progress.</p>}
          </div>
          <div className="mw-col">
            <h4>Next actions</h4>
            {data.nextActions.slice(0, 5).map((t) => <Item key={t.id} task={t} sub={`→ ${t.nextAction}`} />)}
            {!data.nextActions.length && <p className="ws-muted">Add a next action to a task to see it here.</p>}
          </div>
          <div className="mw-col">
            <h4>Blocked & due soon</h4>
            {data.blocked.slice(0, 3).map((t) => <Item key={t.id} task={t} sub={`⛔ ${t.blockerDetails || t.text}`} />)}
            {data.dueSoon.filter((t) => t.status !== 'blocked').slice(0, 4).map((t) => <Item key={t.id} task={t} />)}
            {!data.blocked.length && !data.dueSoon.length && <p className="ws-muted">Nothing blocked or due this week.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
