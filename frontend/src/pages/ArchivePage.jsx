import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  Archive, Trash2, RotateCcw, Star, Search, X, Undo2,
} from 'lucide-react';
import {
  getArchive, getTrash, getFavorites, unarchiveItem, restoreItem,
  purgeItem, emptyTrash, toggleFavorite,
} from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { SkeletonRows } from '../components/Skeleton';
import './ArchivePage.css';

const TABS = [
  { id: 'archive', label: 'Archived', icon: Archive },
  { id: 'trash', label: 'Trash', icon: Trash2 },
  { id: 'favorites', label: 'Starred', icon: Star },
];

const TYPE_LABELS = {
  note: 'Note', book: 'Book', show: 'Show', table: 'Table',
  habit: 'Habit', goal: 'Goal', sticky: 'Sticky',
};

export default function ArchivePage() {
  const [tab, setTab] = useState('archive');
  const [items, setItems] = useState([]);
  const [retention, setRetention] = useState(30);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [busy, setBusy] = useState({});
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fetcher = tab === 'archive' ? getArchive : tab === 'trash' ? getTrash : getFavorites;
      const data = await fetcher();
      setItems(data.items || []);
      if (data.retentionDays) setRetention(data.retentionDays);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load that list');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const mark = (key, value) => setBusy((prev) => ({ ...prev, [key]: value }));

  /** Optimistically drop the row, and put it back if the call fails. */
  const act = async (item, fn, message) => {
    const key = `${item.type}-${item._id}`;
    if (busy[key]) return;
    mark(key, true);
    const snapshot = items;
    setItems((prev) => prev.filter((i) => !(i._id === item._id && i.type === item.type)));
    try {
      await fn();
      toast.success(message);
    } catch (err) {
      setItems(snapshot);
      toast.error(err.response?.data?.error || 'That did not work');
    } finally {
      mark(key, false);
    }
  };

  const onEmptyTrash = async () => {
    setConfirm(null);
    try {
      const result = await emptyTrash();
      toast.success(result.message);
      setItems([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not empty the trash');
    }
  };

  const onUnstar = async (item) => {
    await act(item, () => toggleFavorite(item.type, item._id, false), 'Removed from starred');
  };

  const types = useMemo(() => {
    const present = new Set(items.map((i) => i.type));
    return ['all', ...Object.keys(TYPE_LABELS).filter((t) => present.has(t))];
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (q && !item.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, typeFilter]);

  const activeTab = TABS.find((t) => t.id === tab);

  return (
    <div className="archive-page page-enter">
      <header className="page-header">
        <div>
          <h1>Archive</h1>
          <p className="page-header-sub">
            {tab === 'trash'
              ? `Deleted items are kept for ${retention} days before they can be purged.`
              : tab === 'archive'
                ? 'Things you shelved without deleting.'
                : 'Everything you starred, across every list.'}
          </p>
        </div>
        {tab === 'trash' && items.length > 0 && (
          <div className="page-header-actions">
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => setConfirm('empty')}
            >
              <Trash2 size={14} /> Empty trash
            </button>
          </div>
        )}
      </header>

      <div className="archive-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`archive-tab ${tab === id ? 'active' : ''}`}
            onClick={() => { setTab(id); setTypeFilter('all'); }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {items.length > 0 && (
        <div className="archive-toolbar">
          <div className="filter-bar" style={{ margin: 0 }}>
            {types.map((t) => (
              <button
                key={t}
                type="button"
                className={`filter-btn ${typeFilter === t ? 'active' : ''}`}
                onClick={() => setTypeFilter(t)}
              >
                {t === 'all' ? 'All' : `${TYPE_LABELS[t]}s`}
              </button>
            ))}
          </div>

          <div className="filter-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              aria-label="Filter archive"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear filter">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonRows count={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={activeTab?.icon || Archive}
          title={
            query || typeFilter !== 'all'
              ? 'Nothing matches those filters'
              : tab === 'trash'
                ? 'Trash is empty'
                : tab === 'archive'
                  ? 'Nothing archived'
                  : 'Nothing starred yet'
          }
          description={
            query || typeFilter !== 'all'
              ? 'Try widening the filter.'
              : tab === 'trash'
                ? 'Deleted notes, books, habits and the rest wait here before they are gone for good.'
                : tab === 'archive'
                  ? 'Archiving hides something from its list without deleting it — useful for finished books or paused habits.'
                  : 'Star anything you want within reach and it collects here.'
          }
          actionLabel={query || typeFilter !== 'all' ? 'Clear filters' : undefined}
          onAction={() => { setQuery(''); setTypeFilter('all'); }}
        />
      ) : (
        <ul className="archive-list">
          {visible.map((item) => {
            const key = `${item.type}-${item._id}`;
            const stamp = item.deletedAt || item.archivedAt || item.createdAt;
            return (
              <li key={key} className="archive-item">
                <span className={`archive-type type-${item.type}`}>{TYPE_LABELS[item.type]}</span>

                <div className="grow">
                  <strong className="truncate">{item.title}</strong>
                  <span>
                    {tab === 'trash' ? 'Deleted ' : tab === 'archive' ? 'Archived ' : 'Added '}
                    {stamp ? formatDistanceToNow(new Date(stamp), { addSuffix: true }) : 'recently'}
                  </span>
                </div>

                <div className="archive-actions">
                  {tab === 'trash' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy[key]}
                        onClick={() =>
                          act(item, () => restoreItem(item.type, item._id), `${TYPE_LABELS[item.type]} restored`)
                        }
                      >
                        <Undo2 size={13} /> Restore
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn-sm icon-btn-danger"
                        disabled={busy[key]}
                        onClick={() => setConfirm(item)}
                        aria-label="Delete permanently"
                        title="Delete permanently"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}

                  {tab === 'archive' && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy[key]}
                      onClick={() =>
                        act(item, () => unarchiveItem(item.type, item._id), `${TYPE_LABELS[item.type]} restored`)
                      }
                    >
                      <RotateCcw size={13} /> Unarchive
                    </button>
                  )}

                  {tab === 'favorites' && (
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm is-active"
                      disabled={busy[key]}
                      onClick={() => onUnstar(item)}
                      aria-label="Remove star"
                      title="Remove star"
                    >
                      <Star size={14} fill="currentColor" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirm === 'empty'}
        title="Empty the trash?"
        message={`This permanently deletes all ${items.length} item(s) in the trash. It cannot be undone.`}
        confirmLabel="Delete everything"
        danger
        onConfirm={onEmptyTrash}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={!!confirm && confirm !== 'empty'}
        title={`Permanently delete this ${confirm?.type ? TYPE_LABELS[confirm.type].toLowerCase() : 'item'}?`}
        message={`"${confirm?.title || ''}" will be gone for good. This cannot be undone.`}
        confirmLabel="Delete forever"
        danger
        onConfirm={() => {
          const item = confirm;
          setConfirm(null);
          act(item, () => purgeItem(item.type, item._id), 'Permanently deleted');
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
