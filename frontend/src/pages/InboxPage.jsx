import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format, isToday, isTomorrow, isPast, startOfDay, addDays } from 'date-fns';
import {
  Inbox, Check, Trash2, PenLine, Target, Flame, StickyNote, Search, Pin, Sparkles,
  Eraser, X, Archive, RotateCcw, CalendarDays, AlertTriangle, ArrowRight, Clock,
  MessageSquare, ChevronDown, CornerDownLeft,
} from 'lucide-react';
import {
  getInbox, createInboxItem, updateInboxItem, toggleInboxItem,
  convertInboxItem, deleteInboxItem, clearDoneInbox,
} from '../utils/api';
import useDebouncedValue from '../hooks/useDebouncedValue';
import EmptyState from '../components/EmptyState';
import { SkeletonRows } from '../components/Skeleton';
import './InboxPage.css';

const TABS = [
  { id: 'open', label: 'To do', icon: Inbox },
  { id: 'done', label: 'Done', icon: Check },
  { id: 'archived', label: 'Archived', icon: Archive },
  { id: 'all', label: 'All', icon: Sparkles },
];

const CONVERSIONS = [
  { id: 'note', icon: PenLine, label: 'Note', hint: 'Write it up in your notebook' },
  { id: 'goal', icon: Target, label: 'Goal', hint: 'Something bigger to work toward' },
  { id: 'habit', icon: Flame, label: 'Habit', hint: 'Do it every day' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky', hint: 'Keep it on screen' },
];

const PRIORITIES = [
  { id: 'high', label: 'Urgent' },
  { id: 'medium', label: 'Normal' },
  { id: 'low', label: 'Low' },
];

function dueInfo(item) {
  if (!item.dueDate) return null;
  const d = new Date(item.dueDate);
  if (isToday(d)) return { label: 'Today', tone: 'today' };
  if (isTomorrow(d)) return { label: 'Tomorrow', tone: 'soon' };
  if (isPast(d)) return { label: `Overdue · ${format(d, 'd MMM')}`, tone: 'overdue' };
  return { label: format(d, 'EEE d MMM'), tone: 'later' };
}

/** Which bucket an open item belongs to — this is what tells you what to do first. */
function bucketOf(item) {
  if (item.status !== 'open') return item.status;
  const due = item.dueDate ? new Date(item.dueDate) : null;
  if (due && due < startOfDay(new Date())) return 'overdue';
  if (due && isToday(due)) return 'today';
  if (item.pinned) return 'pinned';
  if (item.priority === 'high') return 'urgent';
  return 'later';
}

const BUCKETS = [
  { id: 'overdue', title: 'Overdue', hint: 'Past their date — handle these first', icon: AlertTriangle },
  { id: 'today', title: 'Due today', hint: 'Finish before the day ends', icon: Clock },
  { id: 'pinned', title: 'Pinned', hint: 'You marked these as important', icon: Pin },
  { id: 'urgent', title: 'Urgent', hint: 'High priority, no date yet', icon: Flame },
  { id: 'later', title: 'Everything else', hint: 'Do, convert, or archive when you get to it', icon: Inbox },
  { id: 'done', title: 'Done', hint: 'Finished — click the tick to reopen', icon: Check },
  { id: 'archived', title: 'Archived', hint: 'Put away without doing — restore any time', icon: Archive },
];

function InboxCard({ item, busy, onToggle, onPatch, onConvert, onRemove, highlight }) {
  const [convertOpen, setConvertOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(item.note || '');
  const done = item.status === 'done';
  const archived = item.status === 'archived';
  const due = dueInfo(item);
  const ref = useRef(null);

  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  const saveNote = () => {
    setNoteOpen(false);
    if ((item.note || '') !== note) onPatch(item, { note });
  };

  return (
    <li ref={ref} className={`ibx-card pri-${item.priority} ${done ? 'is-done' : ''} ${archived ? 'is-archived' : ''} ${highlight ? 'is-highlight' : ''}`}>
      <button
        type="button"
        className="ibx-done"
        onClick={() => onToggle(item)}
        disabled={busy}
        aria-pressed={done}
        title={done ? 'Reopen' : 'Mark as done'}
      >
        <Check size={15} />
        <span>{done ? 'Done' : 'Done?'}</span>
      </button>

      <div className="ibx-main">
        <div className="ibx-text">{item.text}</div>
        <div className="ibx-meta">
          <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
          {due && <span className={`ibx-due ibx-due--${due.tone}`}><CalendarDays size={11} /> {due.label}</span>}
          {item.convertedTo && <span className="ibx-chip">became a {item.convertedTo}</span>}
          {(item.tags || []).map((t) => <span key={t} className="ibx-chip">#{t}</span>)}
        </div>

        {(item.note && !noteOpen) && (
          <button type="button" className="ibx-note" onClick={() => setNoteOpen(true)}>{item.note}</button>
        )}
        {noteOpen && (
          <textarea
            className="ibx-note-edit"
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote(); }}
            placeholder="Add details… (Ctrl+Enter to save)"
            maxLength={4000}
          />
        )}

        {!done && !archived && (
          <div className="ibx-controls">
            <div className="ibx-group" role="group" aria-label="Priority">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`ibx-pri ibx-pri--${p.id} ${item.priority === p.id ? 'active' : ''}`}
                  onClick={() => item.priority !== p.id && onPatch(item, { priority: p.id })}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="ibx-group" role="group" aria-label="Due date">
              <button type="button" className={`ibx-pill ${due?.tone === 'today' ? 'active' : ''}`} onClick={() => onPatch(item, { dueDate: startOfDay(new Date()).toISOString() })}>Today</button>
              <button type="button" className={`ibx-pill ${due?.tone === 'soon' ? 'active' : ''}`} onClick={() => onPatch(item, { dueDate: startOfDay(addDays(new Date(), 1)).toISOString() })}>Tomorrow</button>
              <label className="ibx-pill ibx-date">
                <CalendarDays size={12} />
                <input
                  type="date"
                  value={item.dueDate ? format(new Date(item.dueDate), 'yyyy-MM-dd') : ''}
                  onChange={(e) => onPatch(item, { dueDate: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : null })}
                  aria-label="Pick a due date"
                />
              </label>
              {item.dueDate && (
                <button type="button" className="ibx-pill" onClick={() => onPatch(item, { dueDate: null })} title="Clear date"><X size={12} /></button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="ibx-side">
        {!done && !archived && !item.convertedId && (
          <div className="ibx-convert">
            <button type="button" className="ibx-action ibx-action--primary" onClick={() => setConvertOpen((v) => !v)} aria-expanded={convertOpen}>
              Turn into <ChevronDown size={13} />
            </button>
            {convertOpen && (
              <div className="ibx-convert-menu" onMouseLeave={() => setConvertOpen(false)}>
                {CONVERSIONS.map(({ id, icon: Icon, label, hint }) => (
                  <button key={id} type="button" onClick={() => { setConvertOpen(false); onConvert(item, id); }} disabled={busy}>
                    <Icon size={15} />
                    <span><strong>{label}</strong><em>{hint}</em></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="ibx-icons">
          {!done && !archived && (
            <button type="button" className={`ibx-icon ${item.pinned ? 'active' : ''}`} onClick={() => onPatch(item, { pinned: !item.pinned })} title={item.pinned ? 'Unpin' : 'Pin to top'} aria-label={item.pinned ? 'Unpin' : 'Pin'}>
              <Pin size={14} />
            </button>
          )}
          <button type="button" className="ibx-icon" onClick={() => setNoteOpen(true)} title="Add a note" aria-label="Add a note">
            <MessageSquare size={14} />
          </button>
          {archived ? (
            <button type="button" className="ibx-icon" onClick={() => onPatch(item, { status: 'open' })} title="Restore to To do" aria-label="Restore">
              <RotateCcw size={14} />
            </button>
          ) : (
            <button type="button" className="ibx-icon" onClick={() => onPatch(item, { status: 'archived' })} title="Archive — put away without doing" aria-label="Archive">
              <Archive size={14} />
            </button>
          )}
          <button type="button" className="ibx-icon ibx-icon--danger" onClick={() => onRemove(item)} title="Delete forever" aria-label="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function InboxPage() {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ open: 0, done: 0, archived: 0 });
  const [tab, setTab] = useState('open');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [draftPriority, setDraftPriority] = useState('medium');
  const [draftDue, setDraftDue] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState({});
  const [showGuide, setShowGuide] = useState(() => {
    try { return localStorage.getItem('sortlife_inbox_guide') !== 'hidden'; } catch { return true; }
  });
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get('item');

  const debouncedQuery = useDebouncedValue(query, 250);

  const load = useCallback(async () => {
    try {
      const data = await getInbox({ status: tab, q: debouncedQuery || undefined });
      setItems(data.items || []);
      setCounts(data.counts || {});
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load your inbox');
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedQuery]);

  useEffect(() => { load(); }, [load]);

  const hideGuide = () => {
    setShowGuide(false);
    try { localStorage.setItem('sortlife_inbox_guide', 'hidden'); } catch { /* ignore */ }
  };

  const mark = (key, value) => setBusy((prev) => ({ ...prev, [key]: value }));

  const add = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setAdding(true);
    try {
      const item = await createInboxItem({
        text,
        priority: draftPriority,
        dueDate: draftDue ? new Date(`${draftDue}T00:00:00`).toISOString() : undefined,
      });
      if (tab === 'open' || tab === 'all') setItems((prev) => [item, ...prev]);
      setCounts((prev) => ({ ...prev, open: (prev.open || 0) + 1 }));
      setDraft('');
      setDraftDue('');
      setDraftPriority('medium');
      inputRef.current?.focus();
      toast.success('Captured');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not capture that');
    } finally {
      setAdding(false);
    }
  };

  /* Moving an item between statuses: update counts, drop it from a tab it
     no longer belongs to, keep it (with the new status) on "All". */
  const applyStatus = (item, status) => {
    setItems((prev) => (tab === 'all' || tab === status
      ? prev.map((i) => (i._id === item._id ? { ...i, status } : i))
      : prev.filter((i) => i._id !== item._id)));
    setCounts((prev) => ({
      ...prev,
      [item.status]: Math.max(0, (prev[item.status] || 0) - 1),
      [status]: (prev[status] || 0) + 1,
    }));
  };

  const toggle = async (item) => {
    if (busy[item._id]) return;
    mark(item._id, true);
    const next = item.status === 'done' ? 'open' : 'done';
    applyStatus(item, next);
    try {
      await toggleInboxItem(item._id);
      if (next === 'done') toast.success('Nice — marked done');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update that');
      load();
    } finally {
      mark(item._id, false);
    }
  };

  const patch = async (item, data) => {
    if (data.status && data.status !== item.status) applyStatus(item, data.status);
    else setItems((prev) => prev.map((i) => (i._id === item._id ? { ...i, ...data } : i)));
    try {
      await updateInboxItem(item._id, data);
      if (data.status === 'archived') toast.success('Archived');
      if (data.status === 'open' && item.status === 'archived') toast.success('Restored to To do');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update that');
      load();
    }
  };

  const convert = async (item, target) => {
    if (busy[item._id]) return;
    mark(item._id, true);
    try {
      const result = await convertInboxItem(item._id, target);
      applyStatus(item, 'done');
      toast.success(`Turned into a ${target}`);
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
    setCounts((prev) => ({ ...prev, [item.status]: Math.max(0, (prev[item.status] || 0) - 1) }));
    try {
      await deleteInboxItem(item._id);
      toast.success('Deleted');
    } catch (err) {
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

  const grouped = useMemo(() => {
    const map = new Map(BUCKETS.map((b) => [b.id, []]));
    for (const item of items) map.get(bucketOf(item))?.push(item);
    return BUCKETS.map((b) => ({ ...b, items: map.get(b.id) })).filter((b) => b.items.length);
  }, [items]);

  const openItems = items.filter((i) => i.status === 'open');
  const summary = {
    overdue: openItems.filter((i) => bucketOf(i) === 'overdue').length,
    today: openItems.filter((i) => bucketOf(i) === 'today').length,
    urgent: openItems.filter((i) => i.priority === 'high').length,
  };

  return (
    <div className="ibx-page page-enter">
      {/* ── Header with live summary ─────────────────────── */}
      <section className="ibx-hero">
        <div>
          <h1>Inbox</h1>
          <p>
            {counts.open ? (
              <>You have <strong>{counts.open}</strong> thing{counts.open === 1 ? '' : 's'} to deal with
                {summary.overdue ? <> — <strong className="t-red">{summary.overdue} overdue</strong></> : null}
                {summary.today ? <>, <strong className="t-amber">{summary.today} due today</strong></> : null}.</>
            ) : 'Inbox zero. Capture anything that pops into your head below.'}
          </p>
        </div>
        <div className="ibx-hero-stats">
          <div><strong>{counts.open || 0}</strong><span>to do</span></div>
          <div><strong>{summary.urgent}</strong><span>urgent</span></div>
          <div><strong>{counts.done || 0}</strong><span>done</span></div>
        </div>
      </section>

      {showGuide && (
        <section className="ibx-guide">
          <div className="ibx-step"><span>1</span><div><strong>Capture</strong><em>Type anything below and press Enter. Don't sort yet.</em></div></div>
          <ArrowRight size={16} className="ibx-step-arrow" />
          <div className="ibx-step"><span>2</span><div><strong>Decide</strong><em>Set <b>Urgent / Normal / Low</b>, a date, or <b>Turn into</b> a note, goal or habit.</em></div></div>
          <ArrowRight size={16} className="ibx-step-arrow" />
          <div className="ibx-step"><span>3</span><div><strong>Finish</strong><em>Click <b>Done?</b> on the left. Not doing it? <b>Archive</b> it.</em></div></div>
          <button type="button" className="ibx-guide-close" onClick={hideGuide} aria-label="Hide guide"><X size={14} /></button>
        </section>
      )}

      {/* ── Capture bar ──────────────────────────────────── */}
      <form className="ibx-capture" onSubmit={add}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What's on your mind? Press Enter to capture…"
          maxLength={500}
          aria-label="Capture a new item"
        />
        <div className="ibx-capture-opts">
          <div className="ibx-group">
            {PRIORITIES.map((p) => (
              <button key={p.id} type="button" className={`ibx-pri ibx-pri--${p.id} ${draftPriority === p.id ? 'active' : ''}`} onClick={() => setDraftPriority(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <label className="ibx-pill ibx-date">
            <CalendarDays size={12} />
            <input type="date" value={draftDue} onChange={(e) => setDraftDue(e.target.value)} aria-label="Due date" />
          </label>
          <button type="submit" className="ibx-capture-btn" disabled={adding || !draft.trim()}>
            {adding ? 'Saving…' : <>Capture <CornerDownLeft size={13} /></>}
          </button>
        </div>
      </form>

      {/* ── Tabs + search ────────────────────────────────── */}
      <div className="ibx-toolbar">
        <div className="ibx-tabs" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => { setLoading(true); setTab(id); }}>
              <Icon size={14} /> {label}
              {id !== 'all' && <em>{counts[id] || 0}</em>}
            </button>
          ))}
        </div>
        <div className="ibx-toolbar-right">
          <div className="ibx-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search inbox…" aria-label="Search inbox" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={13} /></button>}
          </div>
          {tab === 'done' && (counts.done || 0) > 0 && (
            <button type="button" className="ibx-action" onClick={clearDone}><Eraser size={14} /> Clear done</button>
          )}
          {!showGuide && (
            <button type="button" className="ibx-action" onClick={() => setShowGuide(true)}>How it works</button>
          )}
        </div>
      </div>

      {/* ── Grouped list ─────────────────────────────────── */}
      {loading ? (
        <SkeletonRows count={6} />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={query ? Search : Sparkles}
          title={query ? 'Nothing matches that' : tab === 'done' ? 'Nothing finished yet' : tab === 'archived' ? 'Nothing archived' : 'Inbox zero'}
          description={query ? 'Try a shorter search, or switch to All.' : 'Anything you capture lands here, sorted by what needs you first.'}
          actionLabel={query ? 'Clear search' : undefined}
          onAction={query ? () => setQuery('') : undefined}
        />
      ) : (
        grouped.map((group) => (
          <section key={group.id} className={`ibx-bucket ibx-bucket--${group.id}`}>
            <header>
              <group.icon size={15} />
              <h2>{group.title}</h2>
              <span className="ibx-count">{group.items.length}</span>
              <em>{group.hint}</em>
            </header>
            <ul className="ibx-list">
              {group.items.map((item) => (
                <InboxCard
                  key={item._id}
                  item={item}
                  busy={!!busy[item._id]}
                  highlight={highlight === item._id}
                  onToggle={toggle}
                  onPatch={patch}
                  onConvert={convert}
                  onRemove={remove}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
