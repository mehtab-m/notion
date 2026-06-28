import React, { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import useApi from '../hooks/useApi';
import { getProjects, deleteProject } from '../utils/api';
import ProjectCard from '../components/Projects/ProjectCard';
import ProjectModal from '../components/Projects/ProjectModal';
import './ProjectsPage.css';

const STATUS_FILTERS = ['all', 'active', 'planned', 'on-hold', 'completed'];
const PRIORITY_FILTERS = ['all', 'high', 'medium', 'low'];

export default function ProjectsPage() {
  const { data: projects, loading, refetch } = useApi(getProjects);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);

  const handleDelete = async (id) => {
    try {
      await deleteProject(id);
      toast.success('Project deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete project');
    }
  };

  const handleEdit = (project) => {
    setEditProject(project);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditProject(null);
    setModalOpen(true);
  };

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setEditProject(null);
  }, []);

  const filtered = (projects || []).filter((p) => {
    const statusOk = statusFilter === 'all' || p.status === statusFilter;
    const priorityOk = priorityFilter === 'all' || p.priority === priorityFilter;
    return statusOk && priorityOk;
  });

  return (
    <div>
      <div className="page-header">
        <h1>Projects</h1>
        <button className="btn btn-primary" onClick={handleNew}>
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className="projects-filters">
        <div className="filter-bar">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              className={`filter-btn ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="filter-bar">
          {PRIORITY_FILTERS.map((p) => (
            <button
              key={p}
              className={`filter-btn ${priorityFilter === p ? 'active' : ''}`}
              onClick={() => setPriorityFilter(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7h18M3 12h18M3 17h18"/></svg>
          <h3>No projects found</h3>
          <p>{statusFilter === 'all' ? 'Create your first project.' : `No ${statusFilter} projects.`}</p>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <ProjectModal
          project={editProject}
          onClose={handleClose}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
