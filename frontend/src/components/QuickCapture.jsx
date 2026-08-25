import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Inbox, PenLine, Target, Flame, StickyNote, X, CornerDownLeft, Flag,
} from 'lucide-react';
import { createInboxItem, convertInboxItem } from '../utils/api';
import useFocusTrap from '../hooks/useFocusTrap';
import './QuickCapture.css';

/* Where a captured line can go. `null` keeps it in the inbox, which is
   the point of quick capture — deciding later is cheaper than deciding
   now, and the whole feature dies if it makes you choose up front. */
const TARGETS = [
  { id: null, icon: Inbox, label: 'Inbox', hint: 'Decide later' },
  { id: 'note', icon: PenLine, label: 'Note', hint: 'Write it up' },
  { id: 'goal', icon: Target, label: 'Goal', hint: 'Something to reach' },
  { id: 'habit', icon: Flame, label: 'Habit', hint: 'Do it daily' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky', hint: 'Keep it visible' },
];

const PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Normal' },
  { id: 'high', label: 'Urgent' },
];

export default function QuickCapture({ open, onClose, onCaptured }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [target, setTarget] = useState(null);
  const [priority, setPriority] = useState('medium');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  // Traps Tab, closes on Escape, and locks the page behind the dialog.
  const cardRef = useFocusTrap(open, { onEscape: onClose, autoFocus: false });

  useEffect(() => {
    if (!open) return;
    setText('');
    setNote('');
    setTarget(null);
    setPriority('medium');
    // The point is to type immediately — focus after the entry animation.
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e?.preventDefault();
    const value = text.trim();
    if (!value) return;

    setSaving(true);
    try {
      const item = await createInboxItem({ text: value, note: note.trim(), priority });

      if (target) {
        const result = await convertInboxItem(item._id, target);
        toast.success(`Saved as ${target}`);
        onCaptured?.(result);
        onClose();
        if (result?.url) navigate(result.url);
        return;
      }

      toast.success('Captured to inbox');
      onCaptured?.({ item });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save that');
    } finally {
      setSaving(false);
    }
  };

  /* Cmd/Ctrl+Enter submits from the notes field too, so the whole form
     can be filled without ever reaching for the mouse. */
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
  };

  return (
    <div className="qc-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="qc-card"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick capture"
      >
        <form onSubmit={submit}>
          <div className="qc-head">
            <span className="qc-head-icon"><Inbox size={15} /></span>
            <span className="qc-head-title">Quick capture</span>
            <button type="button" className="qc-close" onClick={onClose} aria-label="Close">
              <X size={17} />
            </button>
          </div>

          <input
            ref={inputRef}
            className="qc-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="What's on your mind?"
            maxLength={500}
            autoComplete="off"
          />

          <textarea
            className="qc-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Add detail (optional)"
            rows={2}
          />

          <div className="qc-targets" role="radiogroup" aria-label="Save as">
            {TARGETS.map(({ id, icon: Icon, label, hint }) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={target === id}
                className={`qc-target ${target === id ? 'active' : ''}`}
                onClick={() => setTarget(id)}
                title={hint}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="qc-foot">
            <div className="qc-priority" role="radiogroup" aria-label="Priority">
              <Flag size={13} />
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={priority === p.id}
                  className={`qc-pri ${priority === p.id ? 'active' : ''} pri-${p.id}`}
                  onClick={() => setPriority(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !text.trim()}>
              {saving ? 'Saving…' : 'Capture'}
              <CornerDownLeft size={13} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
