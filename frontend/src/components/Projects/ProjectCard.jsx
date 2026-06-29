import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckSquare, Database, Trash2 } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import './ProjectCard.css';

const statusClass = {
  active: 'badge-active',
  completed: 'badge-completed',
  'on-hold': 'badge-on-hold',
  planned: 'badge-planned',
};

export default function ProjectCard({ project, onDelete }) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const taskCount = (project.tasks || []).length;
  const tableCount = (project.dataTables || []).length;
  const doneTasks = (project.tasks || []).filter((t) => t.done).length;
  const dueDate = project.dueDate ? new Date(project.dueDate) : null;
  const overdue = dueDate && isPast(dueDate) && !isToday(dueDate) && project.status !== 'completed';
  const accentColor = project.color || 'var(--accent)';

  return (
    <div
      className="project-card"
      style={{ borderTopColor: accentColor }}
      onClick={() => navigate(`/projects/${project._id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/projects/${project._id}`)}
    >
      <div className="project-card-header">
        <span className={`badge ${statusClass[project.status] || ''}`}>{project.status}</span>
        <div className="project-card-actions" onClick={(e) => e.stopPropagation()}>
          {!confirmDelete ? (
            <button className="card-action-btn danger" onClick={() => setConfirmDelete(true)} title="Delete">
              <Trash2 size={14} />
            </button>
          ) : (
            <div className="confirm-delete">
              <button className="btn btn-danger btn-sm" onClick={() => onDelete(project._id)}>Yes</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>No</button>
            </div>
          )}
        </div>
      </div>

      <h3 className="project-card-title">{project.title}</h3>

      {dueDate && (
        <div className={`project-card-deadline ${overdue ? 'overdue' : ''}`}>
          <Calendar size={13} />
          <span>{format(dueDate, 'MMM d, yyyy')}</span>
          {overdue && <span className="overdue-tag">Overdue</span>}
        </div>
      )}

      {taskCount > 0 && (
        <div className="project-card-progress">
          <div className="project-progress-label">
            <span>Tasks</span>
            <span>{project.progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${project.progress}%` }} />
          </div>
          <span className="project-task-count">{doneTasks}/{taskCount} tasks done</span>
        </div>
      )}

      <div className="project-card-footer">
        {taskCount > 0 && (
          <div className="project-card-meta-item">
            <CheckSquare size={12} />
            <span>{taskCount} tasks</span>
          </div>
        )}
        {tableCount > 0 && (
          <div className="project-card-meta-item">
            <Database size={12} />
            <span>{tableCount} tables</span>
          </div>
        )}
        {(project.team || []).length > 0 && (
          <div className="project-assignees">
            {project.team.slice(0, 3).map((a, i) => (
              <span key={i} className="assignee-avatar" title={a}>
                {a.charAt(0).toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
