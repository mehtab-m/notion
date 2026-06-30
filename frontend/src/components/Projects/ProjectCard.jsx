import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, CheckSquare, Database, Trash2, Users, Clock, ArrowUpRight, Share2,
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import './ProjectCard.css';

const statusClass = {
  active: 'badge-active',
  completed: 'badge-completed',
  'on-hold': 'badge-on-hold',
  planned: 'badge-planned',
};

const statusColors = {
  active: '#6366f1',
  completed: '#10b981',
  'on-hold': '#f59e0b',
  planned: '#8b5cf6',
};

const priorityClass = {
  high: 'priority-high',
  medium: 'priority-medium',
  low: 'priority-low',
};

export default function ProjectCard({ project, onDelete }) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const taskCount = (project.tasks || []).length;
  const tableCount = (project.dataTables || []).length;
  const memberCount = (project.members || []).filter((m) => m.status === 'accepted').length;
  const doneTasks = (project.tasks || []).filter((t) => t.done).length;
  const dueDate = project.dueDate ? new Date(project.dueDate) : null;
  const overdue = dueDate && isPast(dueDate) && !isToday(dueDate) && project.status !== 'completed';
  const accent = project.color || statusColors[project.status] || 'var(--accent)';
  const progress = project.progress || 0;
  const isShared = project.isOwner === false;

  return (
    <article
      className="project-card-v2"
      style={{ '--card-accent': accent }}
      onClick={() => navigate(`/projects/${project._id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/projects/${project._id}`)}
    >
      <div className="project-card-v2-glow" />
      <div className="project-card-v2-top">
        <div className="project-card-v2-badges">
          <span className={`badge ${statusClass[project.status] || ''}`}>{project.status}</span>
          {project.priority && (
            <span className={`priority-badge ${priorityClass[project.priority] || ''}`}>{project.priority}</span>
          )}
          {isShared && (
            <span className="project-shared-badge"><Share2 size={11} /> Shared</span>
          )}
        </div>
        <div className="project-card-actions" onClick={(e) => e.stopPropagation()}>
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

      <div className="project-card-v2-body">
        <div className="project-card-v2-main">
          <h3 className="project-card-v2-title">{project.title}</h3>
          {project.description && <p className="project-card-v2-desc">{project.description}</p>}

          {dueDate && (
            <div className={`project-card-deadline ${overdue ? 'overdue' : ''}`}>
              <Calendar size={13} />
              <span>{format(dueDate, 'MMM d, yyyy')}</span>
              {overdue && <span className="overdue-tag">Overdue</span>}
            </div>
          )}

          <div className="project-card-v2-stats">
            {taskCount > 0 && (
              <span className="project-stat-chip">
                <CheckSquare size={13} />
                {doneTasks}/{taskCount} tasks
              </span>
            )}
            {tableCount > 0 && (
              <span className="project-stat-chip">
                <Database size={13} />
                {tableCount} tables
              </span>
            )}
            {memberCount > 0 && (
              <span className="project-stat-chip">
                <Users size={13} />
                {memberCount} members
              </span>
            )}
          </div>
        </div>

        <div className="project-card-v2-ring" aria-hidden>
          <svg viewBox="0 0 36 36">
            <path
              className="ring-bg"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="ring-fill"
              strokeDasharray={`${progress}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="ring-label">{progress}%</span>
        </div>
      </div>

      <div className="project-card-v2-footer">
        <span className="project-card-v2-updated">
          <Clock size={12} />
          Updated {format(new Date(project.updatedAt || project.createdAt), 'MMM d')}
        </span>
        <span className="project-card-v2-open">
          Open <ArrowUpRight size={14} />
        </span>
      </div>
    </article>
  );
}
