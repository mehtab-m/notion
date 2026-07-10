import React, { useState, useCallback, useRef } from 'react';
import { Plus, Pin, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import useApi from '../hooks/useApi';
import { getStickyNotes, createStickyNote, updateStickyNote, deleteStickyNote } from '../utils/api';
import { useStickyNotesOverlay } from '../context/StickyNotesOverlayContext';
import ConfirmDialog from '../components/ConfirmDialog';
import './StickyNotesPage.css';

const COLORS = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'];

const COLOR_MAP = {
  yellow: { bg: '#fef9c3', text: '#713f12', border: '#fde047' },
  pink:   { bg: '#fce7f3', text: '#831843', border: '#f9a8d4' },
  blue:   { bg: '#dbeafe', text: '#1e3a5f', border: '#93c5fd' },
  green:  { bg: '#dcfce7', text: '#14532d', border: '#86efac' },
  purple: { bg: '#f3e8ff', text: '#4a1d96', border: '#d8b4fe' },
  orange: { bg: '#ffedd5', text: '#7c2d12', border: '#fdba74' },
};

function StickyCard({ note, onUpdate, onDeleteRequest, onShowOnScreen, isHiddenFromScreen }) {
  const [content, setContent] = useState(note.content || '');
  const saveTimer = useRef(null);
  const c = COLOR_MAP[note.color] || COLOR_MAP.yellow;

  const handleChange = (val) => {
    setContent(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdate(note._id, { content: val });
    }, 700);
  };

  return (
    <div
      className={`sticky-card ${isHiddenFromScreen ? 'sticky-card--hidden' : ''}`}
      style={{ '--sticky-bg': c.bg, '--sticky-text': c.text, '--sticky-border': c.border }}
    >
      {isHiddenFromScreen && (
        <span className="sticky-hidden-badge">Hidden from screen</span>
      )}
      <div className="sticky-card-header">
        <div className="sticky-colors">
          {COLORS.map((col) => (
            <button
              key={col}
              className={`sticky-color-dot ${note.color === col ? 'selected' : ''}`}
              style={{ background: COLOR_MAP[col].bg, border: `2px solid ${COLOR_MAP[col].border}` }}
              onClick={() => onUpdate(note._id, { color: col })}
              title={col}
            />
          ))}
        </div>
        <div className="sticky-actions">
          {isHiddenFromScreen && (
            <button
              className="sticky-show"
              onClick={() => onShowOnScreen(note._id)}
              title="Show on screen"
            >
              <Eye size={13} />
            </button>
          )}
          <button
            className={`sticky-pin ${note.pinned ? 'pinned' : ''}`}
            onClick={() => onUpdate(note._id, { pinned: !note.pinned })}
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={13} />
          </button>
          <button className="sticky-delete" onClick={() => onDeleteRequest(note._id)} title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <textarea
        className="sticky-content"
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Write something..."
      />
    </div>
  );
}

export default function StickyNotesPage() {
  const { data: notes, loading, setData } = useApi(getStickyNotes);
  const [colorFilter, setColorFilter] = useState('all');
  const [deleteId, setDeleteId] = useState(null);
  const { isHiddenFromOverlay, showOnOverlay } = useStickyNotesOverlay();

  const handleAdd = async (color = 'yellow') => {
    const x = 80 + Math.random() * (window.innerWidth - 350);
    const y = 80 + Math.random() * (window.innerHeight - 300);
    try {
      const note = await createStickyNote({
        content: '',
        color,
        pinned: true,
        posX: Math.round(x),
        posY: Math.round(y),
      });
      setData((prev) => [...(prev || []), note]);
    } catch {
      toast.error('Failed to create sticky note');
    }
  };

  const handleUpdate = useCallback(async (id, data) => {
    setData((prev) => (prev || []).map((n) => (n._id === id ? { ...n, ...data } : n)));
    try {
      const updated = await updateStickyNote(id, data);
      setData((prev) => (prev || []).map((n) => (n._id === id ? updated : n)));
    } catch {
      toast.error('Failed to update');
    }
  }, [setData]);

  const handleDelete = useCallback(async (id) => {
    setData((prev) => (prev || []).filter((n) => n._id !== id));
    try {
      await deleteStickyNote(id);
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }, [setData]);

  const filtered = (notes || []).filter(
    (n) => colorFilter === 'all' || n.color === colorFilter
  );

  return (
    <div>
      <div className="page-header">
        <h1>Sticky Notes</h1>
        <div className="sticky-add-row">
          {COLORS.map((c) => (
            <button
              key={c}
              className="sticky-add-color-btn"
              style={{ background: COLOR_MAP[c].bg, border: `2px solid ${COLOR_MAP[c].border}`, color: COLOR_MAP[c].text }}
              onClick={() => handleAdd(c)}
              title={`Add ${c} note`}
            >
              <Plus size={13} />
            </button>
          ))}
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <button className={`filter-btn ${colorFilter === 'all' ? 'active' : ''}`} onClick={() => setColorFilter('all')}>All</button>
        {COLORS.map((c) => (
          <button
            key={c}
            className={`filter-btn ${colorFilter === c ? 'active' : ''}`}
            onClick={() => setColorFilter(c)}
          >
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Pin size={48} strokeWidth={1} />
          <h3>No sticky notes yet</h3>
          <p>Click a color button above to add a note.</p>
        </div>
      ) : (
        <div className="sticky-grid">
          {filtered.map((note) => (
            <StickyCard
              key={note._id}
              note={note}
              onUpdate={handleUpdate}
              onDeleteRequest={setDeleteId}
              onShowOnScreen={showOnOverlay}
              isHiddenFromScreen={isHiddenFromOverlay(note._id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete sticky note?"
        message="This will permanently remove the note from your screen and this section."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          const id = deleteId;
          setDeleteId(null);
          handleDelete(id);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
