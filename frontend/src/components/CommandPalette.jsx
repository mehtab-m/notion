import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, LayoutDashboard, FolderKanban, BookOpen, Tv, Table as TableIcon,
  PenLine, StickyNote, Target, Flame, Settings, IndianRupee, Shield,
  CornerDownLeft, ArrowUp, ArrowDown, FileText, BookMarked, Loader2, SearchX,
} from 'lucide-react';
import { searchAll } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import useDebouncedValue from '../hooks/useDebouncedValue';
import useFocusTrap from '../hooks/useFocusTrap';
import './CommandPalette.css';

/* Pages reachable without typing anything — the palette doubles as a
   keyboard-only navigation menu. */
const PAGES = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, keywords: 'home overview stats' },
  { label: 'Notebook', to: '/notes', icon: PenLine, keywords: 'notes writing pages' },
  { label: 'Sticky Notes', to: '/stickynotes', icon: StickyNote, keywords: 'stickies reminders' },
  { label: 'Projects', to: '/projects', icon: FolderKanban, keywords: 'tasks kanban work', developer: true },
  { label: 'Money', to: '/money', icon: IndianRupee, keywords: 'ledger debts friends cash' },
  { label: 'Goals', to: '/goals', icon: Target, keywords: 'objectives milestones' },
  { label: 'Habits', to: '/habits', icon: Flame, keywords: 'streaks routine daily' },
  { label: 'Books', to: '/books', icon: BookOpen, keywords: 'reading library' },
  { label: 'Shows', to: '/shows', icon: Tv, keywords: 'movies series watching' },
  { label: 'Tables', to: '/tables', icon: TableIcon, keywords: 'spreadsheet data grid' },
  { label: 'Settings', to: '/settings', icon: Settings, keywords: 'account theme profile password' },
  { label: 'Admin', to: '/admin', icon: Shield, keywords: 'users analytics product', admin: true },
];

const TYPE_ICON = {
  note: FileText,
  notebook: BookMarked,
  project: FolderKanban,
  goal: Target,
  habit: Flame,
  book: BookOpen,
  show: Tv,
  table: TableIcon,
  sticky: StickyNote,
  money: IndianRupee,
};

const TYPE_LABEL = {
  note: 'Note',
  notebook: 'Notebook',
  project: 'Project',
  goal: 'Goal',
  habit: 'Habit',
  book: 'Book',
  show: 'Show',
  table: 'Table',
  sticky: 'Sticky',
  money: 'Money',
};

export default function CommandPalette({ open, onClose, initialQuery = '' }) {
  const navigate = useNavigate();
  const { isDeveloper, isAdmin } = useAuth();

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const dialogRef = useFocusTrap(open, { onEscape: onClose, autoFocus: false });

  const debouncedQuery = useDebouncedValue(query.trim(), 220);

  const pages = useMemo(
    () =>
      PAGES.filter((p) => (!p.developer || isDeveloper) && (!p.admin || isAdmin)),
    [isDeveloper, isAdmin]
  );

  /* Page matches are computed locally so navigation stays instant even
     while the server-side content search is still in flight. */
  const pageMatches = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) => p.label.toLowerCase().includes(q) || p.keywords.includes(q)
    );
  }, [pages, debouncedQuery]);

  const items = useMemo(
    () => [
      ...pageMatches.map((p) => ({ kind: 'page', id: `page:${p.to}`, ...p })),
      ...results.map((r) => ({ kind: 'result', id: `${r.type}:${r._id}`, ...r })),
    ],
    [pageMatches, results]
  );

  // Reset when the palette is opened.
  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setActiveIndex(0);
    setFailed(false);
    // Autofocus after the open animation begins so the caret is visible.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, initialQuery]);

  // Fetch content matches, cancelling any request the user has outrun.
  useEffect(() => {
    if (!open) return undefined;
    if (debouncedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    searchAll(debouncedQuery, { signal: controller.signal })
      .then((data) => {
        setResults(data.results || []);
        setFailed(false);
      })
      .catch((err) => {
        // An aborted request is expected, not a failure to report.
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setResults([]);
        setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, open]);

  // Keep the highlight in range as results stream in.
  useEffect(() => {
    setActiveIndex((i) => (items.length === 0 ? 0 : Math.min(i, items.length - 1)));
  }, [items.length]);

  const select = useCallback(
    (item) => {
      if (!item) return;
      onClose();
      navigate(item.kind === 'page' ? item.to : item.url);
    },
    [navigate, onClose]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      setActiveIndex((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      setActiveIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(items[activeIndex]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(Math.max(0, items.length - 1));
    }
  };

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  const showEmpty =
    !loading && debouncedQuery.length >= 2 && items.length === 0;

  return (
    <div className="cmdk-overlay" onMouseDown={onClose}>
      <div
        className="cmdk"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="cmdk-input-row">
          {loading ? (
            <Loader2 size={17} className="cmdk-input-icon cmdk-spin" aria-hidden="true" />
          ) : (
            <Search size={17} className="cmdk-input-icon" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            className="cmdk-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes, books, goals, tables… or jump to a page"
            aria-label="Search"
            aria-autocomplete="list"
            aria-controls="cmdk-listbox"
            aria-activedescendant={items[activeIndex]?.id}
            autoComplete="off"
            spellCheck="false"
          />
          <kbd className="cmdk-esc">esc</kbd>
        </div>

        <div className="cmdk-list" ref={listRef} id="cmdk-listbox" role="listbox">
          {items.length > 0 && (
            <>
              {pageMatches.length > 0 && <div className="cmdk-group">Jump to</div>}
              {items.map((item, i) => {
                const isFirstResult =
                  item.kind === 'result' && items[i - 1]?.kind !== 'result';
                const Icon =
                  item.kind === 'page' ? item.icon : TYPE_ICON[item.type] || FileText;
                return (
                  <React.Fragment key={item.id}>
                    {isFirstResult && <div className="cmdk-group">Your content</div>}
                    <div
                      id={item.id}
                      role="option"
                      aria-selected={i === activeIndex}
                      data-active={i === activeIndex}
                      className="cmdk-item"
                      onMouseMove={() => setActiveIndex(i)}
                      onClick={() => select(item)}
                    >
                      <span className="cmdk-item-icon">
                        <Icon size={16} />
                      </span>
                      <span className="cmdk-item-body">
                        <span className="cmdk-item-title">
                          {item.kind === 'page' ? item.label : item.title}
                        </span>
                        {item.kind === 'result' && item.subtitle && (
                          <span className="cmdk-item-sub">{item.subtitle}</span>
                        )}
                      </span>
                      {item.kind === 'result' && (
                        <span className="cmdk-item-type">{TYPE_LABEL[item.type] || 'Item'}</span>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </>
          )}

          {showEmpty && (
            <div className="cmdk-empty">
              <SearchX size={26} />
              <p>
                No matches for <strong>“{debouncedQuery}”</strong>
              </p>
              {failed && <span>Search is unavailable right now — try again shortly.</span>}
            </div>
          )}

          {!loading && debouncedQuery.length < 2 && items.length === 0 && (
            <div className="cmdk-empty">
              <Search size={26} />
              <p>Start typing to search everything you have saved.</p>
            </div>
          )}
        </div>

        <div className="cmdk-footer">
          <span>
            <kbd><ArrowUp size={10} /></kbd>
            <kbd><ArrowDown size={10} /></kbd>
            to navigate
          </span>
          <span>
            <kbd><CornerDownLeft size={10} /></kbd>
            to open
          </span>
          <span className="cmdk-footer-hint">
            Type at least 2 characters to search content
          </span>
        </div>
      </div>
    </div>
  );
}
