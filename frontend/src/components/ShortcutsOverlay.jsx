import React from 'react';
import { X, Keyboard } from 'lucide-react';
import useFocusTrap from '../hooks/useFocusTrap';
import './ShortcutsOverlay.css';

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

const MOD = IS_MAC ? '⌘' : 'Ctrl';

const GROUPS = [
  {
    title: 'Global',
    items: [
      { keys: [MOD, 'K'], label: 'Open search', sep: '+' },
      { keys: ['/'], label: 'Open search' },
      { keys: ['C'], label: 'Quick capture' },
      { keys: ['?'], label: 'This help' },
      { keys: ['Esc'], label: 'Close whatever is open' },
    ],
  },
  {
    title: 'Go to',
    items: [
      { keys: ['G', 'D'], label: 'My Day' },
      { keys: ['G', 'H'], label: 'Dashboard' },
      { keys: ['G', 'I'], label: 'Inbox' },
      { keys: ['G', 'F'], label: 'Focus' },
      { keys: ['G', 'N'], label: 'Notebook' },
      { keys: ['G', 'T'], label: 'Habits' },
      { keys: ['G', 'G'], label: 'Goals' },
      { keys: ['G', 'A'], label: 'Insights' },
      { keys: ['G', 'S'], label: 'Settings' },
    ],
  },
  {
    title: 'Appearance',
    items: [
      { keys: [MOD, 'Shift', 'L'], label: 'Toggle light / dark', sep: '+' },
      { keys: ['T', 'T'], label: 'Next unlocked theme' },
    ],
  },
  {
    title: 'In lists',
    items: [
      { keys: ['↑', '↓'], label: 'Move selection', sep: 'or' },
      { keys: ['Enter'], label: 'Open the highlighted result' },
    ],
  },
];

export default function ShortcutsOverlay({ open, onClose }) {
  const cardRef = useFocusTrap(open, { onEscape: onClose });

  if (!open) return null;

  return (
    <div
      className="shortcuts-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="shortcuts-card"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
      >
        <div className="shortcuts-head">
          <h2><Keyboard size={17} /> Keyboard shortcuts</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="shortcuts-grid">
          {GROUPS.map((group) => (
            <section key={group.title} className="shortcuts-group">
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={`${group.title}-${item.label}-${item.keys.join()}`}>
                    <span>{item.label}</span>
                    <span className="shortcuts-keys">
                      {/* '+' is a chord, 'then' a sequence, 'or' a choice —
                          three different instructions, so they say so. */}
                      {item.keys.map((key, i) => (
                        <React.Fragment key={key + i}>
                          {i > 0 && <em>{item.sep || 'then'}</em>}
                          <kbd>{key}</kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="shortcuts-foot">
          Shortcuts are ignored while you are typing in a field.
        </p>
      </div>
    </div>
  );
}
