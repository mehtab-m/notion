import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  Inbox, Plus, Check, Trash2, PenLine, Target, Flame, StickyNote,
  Flag, Search, Pin, Sparkles, Eraser, X,
} from 'lucide-react';
import {
  getInbox, createInboxItem, updateInboxItem, toggleInboxItem,
  convertInboxItem, deleteInboxItem, clearDoneInbox,
} from '../utils/api';
import useDebouncedValue from '../hooks/useDebouncedValue';
import EmptyState from '../components/EmptyState';
import { SkeletonRows } from '../components/Skeleton';
import './InboxPage.css';

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'Everything' },
];

const CONVERSIONS = [
  { id: 'note', icon: PenLine, label: 'Note' },
  { id: 'goal', icon: Target, label: 'Goal' },
  { id: 'habit', icon: Flame, label: 'Habit' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky' },
];

const PRIORITIES = ['low', 'medium', 'high'];

export default function InboxPage() {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ open: 0, done: 0, archived: 0 });
  const [filter, setFilter] = useState('open');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState({});
  const [expanded, setExpanded] = useState(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const debouncedQuery = useDebouncedValue(query, 250);

  const load = useCallback(async () => {
    try {
      const data = await getInbox({
        status: filter,
        q: debouncedQuery || undefined,
      });
      setItems(data.items || []);
      setCounts(data.counts || {});
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load your inbox');
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedQuery]);

  useEffect(() => { load(); }, [load]);

  /* A deep link from search opens that one item expanded. */
  useEffect(() => {
    const target = searchParams.get('item');
    if (target) setExpanded(target);
  }, [searchParams]);

  const mark = (key, value) => setBusy((prev) => ({ ...prev, [key]: value }));

  const add = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setAdding(true);
    try {
      const item = await createInboxItem({ text });
      setItems((prev) => [item, ...prev]);
      setCounts((prev) => ({ ...prev, open: (prev.open || 0) + 1 }));
      setDraft('');
      inputRef.current?.focus();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not capture that');
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (item) => {
    if (busy[item._id]) return;
    mark(item._id, true);
    const wasDone = item.status === 'done';

    setItems((prev) =>
      filter === 'all'
        ? prev.map((i) => (i._id === item._id ? { ...i, status: wasDone ? 'open' : 'done' } : i))
        : prev.filter((i) => i._id !== item._id)
    );
    setCounts((prev) => ({
      ...prev,
      open: (prev.open || 0) + (wasDone ? 1 : -1),
      done: (prev.done || 0) + (wasDone ? -1 : 1),
    }));

    try {
      await toggleInboxItem(item._id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update that');
      load();
    } finally {
      mark(item._id, false);
    }
  };

  const setPriority = async (item, priority) => {
    setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, priority } : i)));
    try {
      await updateInboxItem(item._id, { priority });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update priority');
      load();
    }
  };

  const togglePin = async (item) => {
    const pinned = !item.pinned;
    setItems((prev) => {
      const next = prev.map((i) => (i._id === item._id ? { ...i, pinned } : i));
      return next.sort((a, b) => Number(b.pinned) - Number(a.pinned));
    });
    try {
      await updateInboxItem(item._id, { pinned });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not pin that');
      load();
    }
  };

  const convert = async (item, target) => {
    if (busy[item._id]) return;
    mark(item._id, true);
    try {
      const result = await convertInboxItem(item._id, target);
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      toast.success(`Moved to ${target}`);
      if (result?.url) navigate(result.url);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not convert that');
    } finally {
      mark(item._id, false);
    }
  };

  const remove = async (item) => {
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i._id !== item._id));
    try {
      await deleteInboxItem(item._id);
      toast.success('Deleted');
    } catch (err) {
      // Put it straight back — a failed delete that looks like a success
      // is how people lose things.
      setItems(snapshot);
      toast.error(err.response?.data?.error || 'Could not delete that');
    }
  };

  const clearDone = async () => {
    try {
      const result = await clearDoneInbox();
      toast.success(result.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not clear those');
    }
  };

  const visible = useMemo(
    () => [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    [items]
  );

  return (
    <div className="inbox-page page-enter">
      <header className="page-header">
        <div>
          <h1>Inbox</h1>
          <p className="page-header-sub">
            Capture first, sort later. {counts.open || 0} open · {counts.done || 0} done
          </p>
        </div>
        <div className="page-header-actions">
          {(counts.done || 0) > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearDone}>
              <Eraser size={14} /> Clear done
            </button>
          )}
        </div>
      </header>

      {/* ── Capture bar ──────────────────────────────────── */}
      <form className="inbox-capture" onSubmit={add}>
        <span className="inbox-capture-icon"><Plus size={17} /></span>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a thought and press Enter…"
          maxLength={500}
          aria-label="Capture a new item"
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={adding || !draft.trim()}>
          {adding ? 'Saving…' : 'Capture'}
        </button>
      </form>

      {/* ── Filters ──────────────────────────────────────── */}
      <div className="inbox-toolbar">
        <div className="filter-bar" style={{ margin: 0 }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`filter-btn ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              {f.id !== 'all' && counts[f.id] > 0 && <em> · {counts[f.id]}</em>}
            </button>
          ))}
        </div>

        <div className="filter-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            aria-label="Filter inbox"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear filter">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── List ─────────────────────────────────────────── */}
      {loading ? (
        <SkeletonRows count={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={query ? Search : Sparkles}
          title={query ? 'Nothing matches that' : filter === 'done' ? 'Nothing finished yet' : 'Inbox zero'}
          description={
            query
              ? 'Try a shorter search, or switch to Everything.'
              : filter === 'done'
                ? 'Items you tick off collect here until you clear them.'
                : 'Anything you capture — from here, the sidebar, or by pressing C — lands in this list.'
          }
          actionLabel={query ? 'Clear filter' : undefined}
          onAction={query ? () => setQuery('') : undefined}
        />
      ) : (
        <ul className="inbox-list">
          {visible.map((item) => {
            const isOpen = expanded === item._id;
            const done = item.status === 'done';
            return (
              <li
                key={item._id}
                className={`inbox-item pri-${item.priority} ${done ? 'is-done' : ''} ${isOpen ? 'is-open' : ''} ${item.pinned ? 'is-pinned' : ''}`}
              >
                <div className="inbox-item-main">
                  <button
                    type="button"
                    className="inbox-check"
                    onClick={() => toggle(item)}
                    disabled={busy[item._id]}
                    aria-label={done ? 'Mark as open' : 'Mark as done'}
                    aria-pressed={done}
                  >
                    <Check size={13} />
                  </button>

                  <button
                    type="button"
                    className="inbox-body"
                    onClick={() => setExpanded(isOpen ? null : item._id)}
                    aria-expanded={isOpen}
                  >
                    <span className="inbox-text">{item.text}</span>
                    <span className="inbox-meta">
                      {item.pinned && <Pin size={10} />}
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      {item.note && <em>· has notes</em>}
                      {item.convertedTo && <em>· became a {item.convertedTo}</em>}
                    </span>
                  </button>

                  <div className="inbox-actions">
                    <button
                      type="button"
                      className={`icon-btn icon-btn-sm ${item.pinned ? 'is-active' : ''}`}
                      onClick={() => togglePin(item)}
                      aria-label={item.pinned ? 'Unpin' : 'Pin'}
                      title={item.pinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm icon-btn-danger"
                      onClick={() => remove(item)}
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="inbox-expand">
                    {item.note && <p className="inbox-note">{item.note}</p>}

                    <div className="inbox-expand-row">
                      <span className="inbox-expand-label"><Flag size={12} /> Priority</span>
                      <div className="segmented">
                        {PRIORITIES.map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={item.priority === p ? 'active' : ''}
                            onClick={() => setPriority(item, p)}
                          >
                            {p === 'medium' ? 'Normal' : p === 'high' ? 'Urgent' : 'Low'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {!item.convertedId && (
                      <div className="inbox-expand-row">
                        <span className="inbox-expand-label"><Inbox size={12} /> Turn into</span>
                        <div className="inbox-convert">
                          {CONVERSIONS.map(({ id, icon: Icon, label }) => (
                            <button
                              key={id}
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => convert(item, id)}
                              disabled={busy[item._id]}
                            >
                              <Icon size={13} /> {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
