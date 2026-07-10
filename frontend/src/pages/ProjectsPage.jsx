import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import useApi from '../hooks/useApi';
import {
  getProjects, deleteProject, getPendingInvitations,
  acceptProjectInvite, declineProjectInvite,
} from '../utils/api';
import ProjectCard from '../components/Projects/ProjectCard';
import ProjectModal from '../components/Projects/ProjectModal';
import './ProjectsPage.css';

const STATUS_FILTERS = ['all', 'active', 'planned', 'on-hold', 'completed'];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { data: projects, loading, refetch } = useApi(getProjects);
  const { data: invites, refetch: refetchInvites } = useApi(getPendingInvitations);
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

  const handleAcceptInvite = async (memberId) => {
    try {
      const project = await acceptProjectInvite(memberId);
      toast.success('Joined project!');
      refetch();
      refetchInvites();
      navigate(`/projects/${project._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to accept');
    }
  };

  const handleDeclineInvite = async (memberId) => {
    try {
      await declineProjectInvite(memberId);
      toast.success('Invitation declined');
      refetchInvites();
    } catch {
      toast.error('Failed to decline');
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
    <div className="projects-page">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="tables-page-subtitle">Track deadlines, tasks, tables & team collaboration</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New Project
        </button>
      </div>

      {invites?.length > 0 && (
        <div className="projects-invites-banner">
          <h3>Pending invitations</h3>
          {invites.map((inv) => (
            <div key={inv._id} className="projects-invite-row">
              <div className="projects-invite-info">
                <strong>{inv.project?.title || 'Project'}</strong>
                <span> · invited by {inv.invitedBy}</span>
              </div>
              <div className="projects-invite-actions">
                <button className="btn btn-primary btn-sm" onClick={() => handleAcceptInvite(inv._id)}>
                  Accept
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleDeclineInvite(inv._id)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
          <p>Create a project or accept a team invitation.</p>
        </div>
      ) : (
        <div className="projects-grid">
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
