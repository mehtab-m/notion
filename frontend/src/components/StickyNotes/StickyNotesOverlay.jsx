import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pin, Trash2, Plus, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStickyNotes, createStickyNote, updateStickyNote, deleteStickyNote } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useStickyNotesOverlay } from '../../context/StickyNotesOverlayContext';
import ConfirmDialog from '../ConfirmDialog';
import './StickyNotesOverlay.css';

const COLORS = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'];

const COLOR_MAP = {
  yellow: { bg: '#fef9c3', text: '#713f12', border: '#fde047' },
  pink:   { bg: '#fce7f3', text: '#831843', border: '#f9a8d4' },
  blue:   { bg: '#dbeafe', text: '#1e3a5f', border: '#93c5fd' },
  green:  { bg: '#dcfce7', text: '#14532d', border: '#86efac' },
  purple: { bg: '#f3e8ff', text: '#4a1d96', border: '#d8b4fe' },
  orange: { bg: '#ffedd5', text: '#7c2d12', border: '#fdba74' },
};

function FloatingSticky({ note, onUpdate, onHide, onDeleteRequest, zIndex, onFocus }) {
  const [content, setContent] = useState(note.content || '');
  const [pos, setPos] = useState({ x: note.posX || 100, y: note.posY || 100 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const posRef = useRef(pos);
  const saveTimer = useRef(null);
  const c = COLOR_MAP[note.color] || COLOR_MAP.yellow;

  posRef.current = pos;

  useEffect(() => {
    setContent(note.content || '');
    setPos({ x: note.posX ?? 100, y: note.posY ?? 100 });
  }, [note._id, note.content, note.posX, note.posY]);

  const savePosition = useCallback((x, y) => {
    onUpdate(note._id, { posX: x, posY: y });
  }, [note._id, onUpdate]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.sticky-float-content') || e.target.closest('.sticky-float-actions')) return;
    onFocus(note._id);
    setDragging(true);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const x = Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - 150, e.clientY - dragOffset.current.y));
      setPos({ x, y });
    };
    const onUp = () => {
      setDragging(false);
      savePosition(posRef.current.x, posRef.current.y);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, savePosition]);

  const handleChange = (val) => {
    setContent(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate(note._id, { content: val }), 700);
  };

  return (
    <div
      className={`sticky-float ${dragging ? 'dragging' : ''}`}
      style={{
        left: pos.x,
        top: pos.y,
        zIndex,
        '--sticky-bg': c.bg,
        '--sticky-text': c.text,
        '--sticky-border': c.border,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="sticky-float-header">
        <div className="sticky-float-colors">
          {COLORS.map((col) => (
            <button
              key={col}
              className={`sticky-color-dot ${note.color === col ? 'selected' : ''}`}
              style={{ background: COLOR_MAP[col].bg, border: `2px solid ${COLOR_MAP[col].border}` }}
              onClick={() => onUpdate(note._id, { color: col })}
            />
          ))}
        </div>
        <div className="sticky-float-actions">
          <button
            className={`sticky-pin ${note.pinned ? 'pinned' : ''}`}
            onClick={() => onUpdate(note._id, { pinned: !note.pinned })}
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={12} />
          </button>
          <button
            className="sticky-hide"
            onClick={() => onHide(note._id)}
            title="Hide from screen"
          >
            <EyeOff size={12} />
          </button>
          <button
            className="sticky-delete"
            onClick={() => onDeleteRequest(note._id)}
            title="Delete permanently"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <textarea
        className="sticky-float-content"
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Sticky note..."
      />
    </div>
  );
}

export default function StickyNotesOverlay() {
  const { user } = useAuth();
  const { hiddenIds, hideFromOverlay } = useStickyNotesOverlay();
  const [notes, setNotes] = useState([]);
  const [topZ, setTopZ] = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const zCounter = useRef(200);

  const fetchNotes = useCallback(async () => {
    if (!user?._id) {
      setNotes([]);
      return;
    }
    try {
      const data = await getStickyNotes();
      setNotes(data);
    } catch {
      setNotes([]);
    }
  }, [user?._id]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleUpdate = useCallback(async (id, data) => {
    setNotes((prev) => prev.map((n) => (n._id === id ? { ...n, ...data } : n)));
    try {
      const updated = await updateStickyNote(id, data);
      setNotes((prev) => prev.map((n) => (n._id === id ? updated : n)));
    } catch {
      toast.error('Failed to update sticky note');
      fetchNotes();
    }
  }, [fetchNotes]);

  const handleDelete = useCallback(async (id) => {
    setNotes((prev) => prev.filter((n) => n._id !== id));
    try {
      await deleteStickyNote(id);
      toast.success('Sticky note deleted');
    } catch {
      toast.error('Failed to delete');
      fetchNotes();
    }
  }, [fetchNotes]);

  const handleAdd = async () => {
    const x = 80 + Math.random() * (window.innerWidth - 350);
    const y = 80 + Math.random() * (window.innerHeight - 300);
    try {
      const note = await createStickyNote({
        content: '',
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        pinned: true,
        posX: Math.round(x),
        posY: Math.round(y),
      });
      setNotes((prev) => [...prev, note]);
    } catch {
      toast.error('Failed to create sticky note');
    }
  };

  const bringToFront = (id) => {
    zCounter.current += 1;
    setTopZ((prev) => ({ ...prev, [id]: zCounter.current }));
  };

  const visibleNotes = notes.filter((n) => !hiddenIds.has(n._id));

  return (
    <>
      <div className="sticky-overlay">
        {visibleNotes.map((note) => (
          <FloatingSticky
            key={note._id}
            note={note}
            onUpdate={handleUpdate}
            onHide={hideFromOverlay}
            onDeleteRequest={setDeleteId}
            zIndex={topZ[note._id] || 200}
            onFocus={bringToFront}
          />
        ))}
      </div>
      <button className="sticky-fab" onClick={handleAdd} title="Add sticky note">
        <Plus size={20} />
      </button>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete sticky note?"
        message="This will permanently remove the note from your screen and the Sticky Notes section."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          const id = deleteId;
          setDeleteId(null);
          handleDelete(id);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
