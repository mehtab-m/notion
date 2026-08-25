import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/* Two-key sequences ("g" then "d"). A flat map keeps adding one to a
   single line rather than a branch in the handler. */
const SEQUENCES = {
  'g d': '/today',
  'g h': '/',
  'g i': '/inbox',
  'g f': '/focus',
  'g n': '/notes',
  'g t': '/habits',
  'g g': '/goals',
  'g a': '/analytics',
  'g s': '/settings',
  'g b': '/books',
  'g m': '/money',
  'g p': '/projects',
};

/** How long a leader key stays armed before the sequence is abandoned. */
const SEQUENCE_TIMEOUT = 1200;

/** True when the event came from somewhere the user is composing text. */
function isTyping(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Wires the app-wide keyboard map. Everything here is deliberately
 * inert while a field has focus — a global "c opens capture" binding
 * that fires mid-sentence is worse than no binding at all.
 */
export default function useKeyboardShortcuts({
  onSearch,
  onQuickCapture,
  onShortcuts,
  onToggleTheme,
  onNextTheme,
  enabled = true,
}) {
  const navigate = useNavigate();
  const pending = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const clearPending = () => {
      pending.current = null;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };

    const arm = (key) => {
      pending.current = key;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(clearPending, SEQUENCE_TIMEOUT);
    };

    const onKeyDown = (e) => {
      const key = e.key?.toLowerCase();
      if (!key) return;

      // ── Chords work everywhere, including inside inputs ──
      if (key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSearch?.();
        return;
      }
      if (key === 'l' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        onToggleTheme?.();
        return;
      }

      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      // ── Sequences ──
      if (pending.current) {
        const combo = `${pending.current} ${key}`;
        const path = SEQUENCES[combo];
        clearPending();
        if (path) {
          e.preventDefault();
          navigate(path);
          return;
        }
        if (combo === 't t') {
          e.preventDefault();
          onNextTheme?.();
          return;
        }
      }

      if (key === 'g' || key === 't') {
        arm(key);
        return;
      }

      // ── Single keys ──
      switch (key) {
        case '/':
          e.preventDefault();
          onSearch?.();
          break;
        case 'c':
          e.preventDefault();
          onQuickCapture?.();
          break;
        case '?':
          e.preventDefault();
          onShortcuts?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, navigate, onSearch, onQuickCapture, onShortcuts, onToggleTheme, onNextTheme]);
}
