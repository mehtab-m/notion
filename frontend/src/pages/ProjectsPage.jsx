import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import useApi from '../hooks/useApi';
import { getProjects, deleteProject } from '../utils/api';
import ProjectCard from '../components/Projects/ProjectCard';
import ProjectModal from '../components/Projects/ProjectModal';
import './ProjectsPage.css';

const STATUS_FILTERS = ['all', 'active', 'planned', 'on-hold', 'completed'];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { data: projects, loading, refetch } = useApi(getProjects);
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);

  const handleDelete = async (id) => {
    try {
      await deleteProject(id);
      toast.success('Project deleted');
      refetch();
    } catch {
      toast.error('Failed to delete project');
    }
  };

  const handleClose = useCallback(() => setModalOpen(false), []);

  const handleCreated = (project) => {
    setModalOpen(false);
    refetch();
    navigate(`/projects/${project._id}`);
  };

  const filtered = (projects || []).filter(
    (p) => statusFilter === 'all' || p.status === statusFilter
  );

  return (
    <div>
      <div className="page-header">
        <h1>Projects</h1>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New Project
        </button>
      </div>

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

      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7h18M3 12h18M3 17h18"/></svg>
          <h3>No projects found</h3>
          <p>Create a project with a name and deadline, then add tasks and data tables inside.</p>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((project) => (
            <ProjectCard key={project._id} project={project} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {modalOpen && (
        <ProjectModal onClose={handleClose} onSaved={refetch} onCreated={handleCreated} />
      )}
    </div>
  );
}
