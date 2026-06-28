import React, { useState } from 'react';
import { Pencil, Trash2, Tv, Star } from 'lucide-react';
import './ShowCard.css';

const BACKEND = 'http://localhost:5000';

const statusClass = {
  watching: 'badge-watching',
  completed: 'badge-completed',
  'want-to-watch': 'badge-want-to-watch',
  paused: 'badge-paused',
  dropped: 'badge-dropped',
};

const platformColors = {
  Netflix: { bg: 'rgba(229,9,20,0.15)', color: '#e50914' },
  HBO: { bg: 'rgba(160,32,240,0.15)', color: '#a020f0' },
  'Disney+': { bg: 'rgba(17,60,207,0.15)', color: '#113ccf' },
  'Apple TV+': { bg: 'rgba(255,255,255,0.1)', color: '#e8e8e8' },
  'Amazon Prime': { bg: 'rgba(0,168,225,0.15)', color: '#00a8e1' },
  Hulu: { bg: 'rgba(28,231,131,0.15)', color: '#1ce783' },
  Other: { bg: 'rgba(96,96,96,0.2)', color: '#a0a0a0' },
};

export default function ShowCard({ show, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pc = platformColors[show.platform] || platformColors.Other;

  return (
    <div className="show-card">
      <div className="show-card-poster">
        {show.posterImage ? (
          <img src={`${BACKEND}${show.posterImage}`} alt={show.title} />
        ) : (
          <div className="show-poster-placeholder">
            <Tv size={32} color="var(--accent-yellow)" />
          </div>
        )}
        <span
          className="show-platform-badge"
          style={{ background: pc.bg, color: pc.color }}
        >
          {show.platform}
        </span>
        <div className="show-card-actions">
          <button className="card-action-btn" onClick={() => onEdit(show)} title="Edit">
            <Pencil size={13} />
          </button>
          {!confirmDelete ? (
            <button className="card-action-btn danger" onClick={() => setConfirmDelete(true)} title="Delete">
              <Trash2 size={13} />
            </button>
          ) : (
            <div className="confirm-delete">
              <button className="btn btn-danger btn-sm" onClick={() => onDelete(show._id)}>Yes</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>No</button>
            </div>
          )}
        </div>
      </div>

      <div className="show-card-body">
        <span className={`badge ${statusClass[show.status] || ''}`}>{show.status.replace(/-/g, ' ')}</span>
        <h3 className="show-card-title">{show.title}</h3>
        <p className="show-card-episode">S{show.currentSeason} E{show.currentEpisode} / {show.totalSeasons} seasons</p>

        {show.rating > 0 && (
          <div className="show-card-stars">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={13}
                fill={s <= show.rating ? 'var(--accent-yellow)' : 'none'}
                color={s <= show.rating ? 'var(--accent-yellow)' : 'var(--text-muted)'}
              />
            ))}
          </div>
        )}

        {show.genre && <span className="show-genre">{show.genre}</span>}
      </div>
    </div>
  );
}
