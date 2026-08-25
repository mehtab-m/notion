import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pin, Trash2, Plus, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStickyNotes, createStickyNote, updateStickyNote, deleteStickyNote } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useStickyNotesOverlay } from '../../context/StickyNotesOverlayContext';
import ConfirmDialog from '../ConfirmDialog';
import { STICKY_COLORS as COLORS, STICKY_COLOR_MAP as COLOR_MAP } from './stickyColors';
import './StickyNotesOverlay.css';

/* Keeps a note inside the viewport. Notes are stored in absolute pixels,
   so one dropped at x=900 on a desktop would otherwise be unreachable the
   next time the same account opens the app on a phone. */
function clampToViewport(x, y, el) {
  const w = el?.offsetWidth || 200;
  const h = el?.offsetHeight || 150;
  const maxX = Math.max(0, window.innerWidth - w - 8);
  const maxY = Math.max(0, window.innerHeight - h - 8);
  return {
    x: Math.round(Math.min(Math.max(0, x), maxX)),
    y: Math.round(Math.min(Math.max(0, y), maxY)),
  };
}

function FloatingSticky({ note, onUpdate, onHide, onDeleteRequest, zIndex, onFocus }) {
  const [content, setContent] = useState(note.content || '');
  const [pos, setPos] = useState({ x: note.posX || 100, y: note.posY || 100 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const posRef = useRef(pos);
  const saveTimer = useRef(null);
  const elRef = useRef(null);
  const c = COLOR_MAP[note.color] || COLOR_MAP.yellow;

  posRef.current = pos;

  useEffect(() => {
    setContent(note.content || '');
    setPos({ x: note.posX ?? 100, y: note.posY ?? 100 });
  }, [note._id, note.content, note.posX, note.posY]);

  // Pull strays back on mount and on rotate/resize.
  useEffect(() => {
    const settle = () => setPos((p) => clampToViewport(p.x, p.y, elRef.current));
    settle();
    window.addEventListener('resize', settle);
    window.addEventListener('orientationchange', settle);
    return () => {
      window.removeEventListener('resize', settle);
      window.removeEventListener('orientationchange', settle);
    };
  }, []);

  const savePosition = useCallback((x, y) => {
    onUpdate(note._id, { posX: x, posY: y });
  }, [note._id, onUpdate]);

  /* Pointer events, not mouse events — the old handlers meant a note
     could not be moved at all on a touch screen. */
  const handlePointerDown = (e) => {
    if (e.target.closest('.sticky-float-content') || e.target.closest('.sticky-float-actions')) return;
    onFocus(note._id);
    setDragging(true);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (e) => {
      setPos(clampToViewport(
        e.clientX - dragOffset.current.x,
        e.clientY - dragOffset.current.y,
        elRef.current,
      ));
    };
    const onUp = () => {
      setDragging(false);
      savePosition(posRef.current.x, posRef.current.y);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, savePosition]);

  const handleChange = (val) => {
    setContent(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate(note._id, { content: val }), 700);
  };

  return (
    <div
      ref={elRef}
      className={`sticky-float ${dragging ? 'dragging' : ''}`}
      style={{
        left: pos.x,
        top: pos.y,
        zIndex,
        '--sticky-bg': c.bg,
        '--sticky-text': c.text,
        '--sticky-border': c.border,
      }}
      onPointerDown={handlePointerDown}
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
    /* Math.max keeps the spread non-negative on narrow phones, where
       `innerWidth - 350` goes below zero and spawned notes off-screen. */
    const x = 24 + Math.random() * Math.max(0, window.innerWidth - 240);
    const y = 80 + Math.random() * Math.max(0, window.innerHeight - 320);
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
