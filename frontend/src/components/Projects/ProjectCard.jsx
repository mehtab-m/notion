import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckSquare, Trash2, Users, Share2 } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import './ProjectCard.css';

const statusColors = {
  active: 'var(--accent)',
  completed: 'var(--accent-green)',
  'on-hold': 'var(--accent-yellow)',
  planned: '#8b5cf6',
  maintenance: '#0ea5e9',
  archived: 'var(--text-muted)',
};

const statusLabel = {
  active: 'In progress',
  completed: 'Done',
  'on-hold': 'Paused',
  planned: 'Planned',
  maintenance: 'Maintenance',
  archived: 'Archived',
};

/** A project shown as a folder: tab on top, name on the front, open on click. */
export default function ProjectCard({ project, onDelete }) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const taskCount = (project.tasks || []).length;
  const doneTasks = (project.tasks || []).filter((t) => t.done).length;
  const memberCount = (project.members || []).filter((m) => m.status === 'accepted').length;
  const dueDate = project.dueDate ? new Date(project.dueDate) : null;
  const overdue = dueDate && isPast(dueDate) && !isToday(dueDate) && project.status !== 'completed';
  const color = project.color || statusColors[project.status] || 'var(--accent)';
  const progress = Math.max(0, Math.min(100, project.progress || 0));
  const isShared = project.isOwner === false;
  const open = () => navigate(`/projects/${project._id}`);

  return (
    <article
      className="folder-card"
      style={{ '--folder': color }}
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      aria-label={`Open project ${project.title}`}
    >
      <span className="folder-tab">
        <span>{statusLabel[project.status] || project.status}</span>
      </span>
      <span className="folder-paper" aria-hidden />
      <div className="folder-front">
        <div className="folder-row">
          <h3 className="folder-title">{project.title}</h3>
          <div className="folder-actions" onClick={(e) => e.stopPropagation()}>
            {!confirmDelete ? (
              project.isOwner !== false && (
                <button className="card-action-btn danger" onClick={() => setConfirmDelete(true)} title="Delete">
                  <Trash2 size={14} />
                </button>
              )
            ) : (
              <div className="confirm-delete">
                <button className="btn btn-danger btn-sm" onClick={() => onDelete(project._id)}>Yes</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>No</button>
              </div>
            )}
          </div>
        </div>

        {project.description && <p className="folder-desc">{project.description}</p>}

        <div className="folder-meta">
          {taskCount > 0 && <span><CheckSquare size={12} /> {doneTasks}/{taskCount}</span>}
          {memberCount > 0 && <span><Users size={12} /> {memberCount}</span>}
          {isShared && <span><Share2 size={12} /> Shared</span>}
          {dueDate && (
            <span className={overdue ? 'overdue' : ''}>
              <Calendar size={12} /> {overdue ? 'Overdue · ' : ''}{format(dueDate, 'MMM d')}
            </span>
          )}
        </div>

        <div className="folder-progress" title={`${progress}% done`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
    </article>
  );
}
