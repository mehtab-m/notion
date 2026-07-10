import React, { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import useApi from '../hooks/useApi';
import { getShows, deleteShow } from '../utils/api';
import ShowCard from '../components/Shows/ShowCard';
import ShowModal from '../components/Shows/ShowModal';
import './ShowsPage.css';

const STATUS_FILTERS = ['all', 'watching', 'want-to-watch', 'completed', 'paused', 'dropped'];
const PLATFORMS = ['All', 'Netflix', 'HBO', 'Disney+', 'Apple TV+', 'Amazon Prime', 'Hulu', 'Other'];

export default function ShowsPage() {
  const { data: shows, loading, refetch } = useApi(getShows);
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editShow, setEditShow] = useState(null);

  const handleDelete = async (id) => {
    try {
      await deleteShow(id);
      toast.success('Show deleted');
      refetch();
    } catch (err) {
      toast.error('Failed to delete show');
    }
  };

  const handleEdit = (show) => {
    setEditShow(show);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditShow(null);
    setModalOpen(true);
  };

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setEditShow(null);
  }, []);

  const filtered = (shows || []).filter((s) => {
    const statusOk = statusFilter === 'all' || s.status === statusFilter;
    const platformOk = platformFilter === 'All' || s.platform === platformFilter;
    return statusOk && platformOk;
  });

  return (
    <div>
      <div className="page-header">
        <h1>Shows</h1>
        <button className="btn btn-primary" onClick={handleNew}>
          <Plus size={16} /> Add Show
        </button>
      </div>

      <div className="shows-filters">
        <div className="filter-bar">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              className={`filter-btn ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'want-to-watch' ? 'Want to Watch' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="filter-bar">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              className={`filter-btn ${platformFilter === p ? 'active' : ''}`}
              onClick={() => setPlatformFilter(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
            <polyline points="17 2 12 7 7 2" />
          </svg>
          <h3>No shows found</h3>
          <p>{statusFilter === 'all' ? 'Start tracking your shows.' : `No ${statusFilter} shows.`}</p>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((show) => (
            <ShowCard key={show._id} show={show} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {modalOpen && (
        <ShowModal show={editShow} onClose={handleClose} onSaved={refetch} />
      )}
    </div>
  );
}
