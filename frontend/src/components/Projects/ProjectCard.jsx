import React, { useState } from 'react';
import { Pencil, Trash2, Calendar, Tag } from 'lucide-react';
import { format } from 'date-fns';
import './ProjectCard.css';

const statusClass = {
  active: 'badge-active',
  completed: 'badge-completed',
  'on-hold': 'badge-on-hold',
  planned: 'badge-planned',
};

const priorityClass = {
  high: 'priority-high',
  medium: 'priority-medium',
  low: 'priority-low',
};

export default function ProjectCard({ project, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="project-card">
      <div className="project-card-header">
        <div className="project-card-badges">
          <span className={`badge ${statusClass[project.status] || ''}`}>{project.status}</span>
          <span className={`priority-badge ${priorityClass[project.priority] || ''}`}>{project.priority}</span>
        </div>
        <div className="project-card-actions">
          <button className="card-action-btn" onClick={() => onEdit(project)} title="Edit">
            <Pencil size={14} />
          </button>
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
      {project.description && (
        <p className="project-card-desc">{project.description}</p>
      )}

      <div className="project-card-progress">
        <div className="project-progress-label">
          <span>Progress</span>
          <span>{project.progress}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{
              width: `${project.progress}%`,
              background: project.priority === 'high'
                ? 'var(--accent-red)'
                : project.priority === 'medium'
                ? 'var(--accent-yellow)'
                : 'var(--accent-green)',
            }}
          />
        </div>
      </div>

      {project.dueDate && (
        <div className="project-card-meta">
          <Calendar size={12} />
          <span>Due {format(new Date(project.dueDate), 'MMM d, yyyy')}</span>
        </div>
      )}

      {project.tags && project.tags.length > 0 && (
        <div className="project-card-tags">
          <Tag size={12} color="var(--text-muted)" />
          {project.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="project-tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
