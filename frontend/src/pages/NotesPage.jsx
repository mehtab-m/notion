import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Trash2, Pin, Search, ChevronRight, ChevronDown,
  Book, FileText, ImagePlus, GripVertical, ArrowLeft,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  getNotes, createNote, updateNote, deleteNote, uploadNoteImage, getApiBase,
} from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import './NotesPage.css';

const BACKEND = getApiBase();
const NOTE_COLORS = ['', '#fef08a', '#bbf7d0', '#bfdbfe', '#f5d0fe', '#fed7aa', '#fecaca'];

function BlockEditor({ blocks, onChange, onUploadImage }) {
  const fileRef = useRef(null);
  const insertIndex = useRef(0);

  const updateBlock = (idx, patch) => {
    const next = blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    onChange(next);
  };

  const addTextBlock = (afterIdx) => {
    const next = [...blocks];
    next.splice(afterIdx + 1, 0, { type: 'text', content: '', order: afterIdx + 1 });
    onChange(next.map((b, i) => ({ ...b, order: i })));
  };

  const triggerImageUpload = (afterIdx) => {
    insertIndex.current = afterIdx;
    fileRef.current?.click();
  };

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { imageUrl } = await onUploadImage(file);
      const next = [...blocks];
      next.splice(insertIndex.current + 1, 0, { type: 'image', imageUrl, content: '', order: insertIndex.current + 1 });
      onChange(next.map((b, i) => ({ ...b, order: i })));
    } catch {
      toast.error('Image upload failed');
    }
    e.target.value = '';
  };

  const removeBlock = (idx) => {
    onChange(blocks.filter((_, i) => i !== idx).map((b, i) => ({ ...b, order: i })));
  };

  if (!blocks.length) {
    return (
      <div className="blocks-empty">
        <p>Start writing or add an image</p>
        <div className="block-add-row">
          <button className="btn btn-secondary btn-sm" onClick={() => onChange([{ type: 'text', content: '', order: 0 }])}>
            <FileText size={13} /> Add text
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => triggerImageUpload(-1)}>
            <ImagePlus size={13} /> Add image
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImageFile} />
      </div>
    );
  }

  return (
    <div className="blocks-editor">
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImageFile} />
      {blocks.map((block, idx) => (
        <div key={idx} className="block-item">
          <div className="block-toolbar">
            <GripVertical size={14} className="block-grip" />
            <button className="block-tool-btn" onClick={() => addTextBlock(idx)} title="Add text below">
              <FileText size={12} />
            </button>
            <button className="block-tool-btn" onClick={() => triggerImageUpload(idx)} title="Add image below">
              <ImagePlus size={12} />
            </button>
            <button className="block-tool-btn danger" onClick={() => removeBlock(idx)} title="Remove block">
              <Trash2 size={12} />
            </button>
          </div>
          {block.type === 'image' ? (
            <div className="block-image">
              <img src={`${BACKEND}${block.imageUrl}`} alt="Page image" />
            </div>
          ) : (
            <textarea
              className="block-text"
              value={block.content || ''}
              onChange={(e) => updateBlock(idx, { content: e.target.value })}
              placeholder="Write here..."
              rows={3}
            />
          )}
        </div>
      ))}
      <div className="block-add-row">
        <button className="btn btn-secondary btn-sm" onClick={() => addTextBlock(blocks.length - 1)}>
          <FileText size={13} /> Add text
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => triggerImageUpload(blocks.length - 1)}>
          <ImagePlus size={13} /> Add image
        </button>
      </div>
    </div>
  );
}

function TreeItem({ item, depth, activeId, expanded, onToggle, onSelect, children }) {
  const isNotebook = item.isNotebook;
  const isExpanded = expanded[item._id];
  const hasChildren = children.length > 0 || isNotebook;

  return (
    <>
      <li
        className={`notes-tree-item ${activeId === item._id ? 'active' : ''}`}
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={() => onSelect(item)}
      >
        {hasChildren ? (
          <button className="tree-toggle" onClick={(e) => { e.stopPropagation(); onToggle(item._id); }}>
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : <span className="tree-spacer" />}
        {isNotebook ? <Book size={13} /> : <FileText size={13} />}
        <span className="tree-label">{item.title || 'Untitled'}</span>
        {item.pinned && <Pin size={10} color="var(--accent-yellow)" />}
        {(item.tags || []).includes('learning-line') && <span className="learning-badge">💡</span>}
      </li>
      {isExpanded && children.map((child) => (
        <TreeItem
          key={child._id}
          item={child}
          depth={depth + 1}
          activeId={activeId}
          expanded={expanded}
          onToggle={onToggle}
          onSelect={onSelect}
          children={[]}
        />
      ))}
    </>
  );
}

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState(null);
  const [deleteNoteId, setDeleteNoteId] = useState(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const saveTimer = useRef(null);

  const fetchNotes = useCallback(async () => {
    try {
      const data = await getNotes();
      setNotes(data);
    } catch {
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  /* No auto-open: the page lands on a gallery of every notebook and you
     pick one. A deep link (?note=id, e.g. from Inbox → Note) still opens
     that page straight away. */
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const target = searchParams.get('note');
    if (loading || !target) return;
    const found = notes.find((n) => String(n._id) === String(target));
    if (found) {
      setActiveNote(found);
      if (found.notebookId) setExpanded((prev) => ({ ...prev, [found.notebookId]: true }));
    }
    setSearchParams({}, { replace: true });
  }, [loading, notes, searchParams, setSearchParams]);

  const openNotebook = (nb) => {
    setActiveNote(nb);
    setExpanded((prev) => ({ ...prev, [nb._id]: true }));
  };

  const notebooks = notes.filter((n) => n.isNotebook);
  const pages = notes.filter((n) => !n.isNotebook);
  const legacyNotes = pages.filter((n) => !n.notebookId && !n.parentId);

  const getChildren = (parentId) =>
    pages.filter((p) => String(p.parentId) === String(parentId) || String(p.notebookId) === String(parentId) && String(p.parentId) === String(parentId))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

  const getNotebookPages = (notebookId) =>
    pages.filter((p) => String(p.notebookId) === String(notebookId) && String(p.parentId) === String(notebookId))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

  const handleNewNotebook = async () => {
    try {
      const note = await createNote({ title: 'New Notebook', isNotebook: true, folder: 'General' });
      setNotes((prev) => [note, ...prev]);
      setActiveNote(note);
      setExpanded((prev) => ({ ...prev, [note._id]: true }));
      toast.success('Notebook created');
    } catch {
      toast.error('Failed to create notebook');
    }
  };

  const handleNewPage = async (notebook) => {
    const pageCount = getNotebookPages(notebook._id).length;
    try {
      const page = await createNote({
        title: 'Untitled Page',
        isNotebook: false,
        notebookId: notebook._id,
        parentId: notebook._id,
        folder: notebook.folder || 'General',
        blocks: [{ type: 'text', content: '', order: 0 }],
        order: pageCount,
      });
      setNotes((prev) => [...prev, page]);
      setActiveNote(page);
      setExpanded((prev) => ({ ...prev, [notebook._id]: true }));
      toast.success('Page created');
    } catch {
      toast.error('Failed to create page');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNote(id);
      await fetchNotes();
      setActiveNote(null);
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const autoSave = useCallback((patch) => {
    if (!activeNote) return;
    const updated = { ...activeNote, ...patch };
    setActiveNote(updated);
    setNotes((prev) => prev.map((n) => (n._id === updated._id ? updated : n)));
    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await updateNote(activeNote._id, updated);
      } catch {
        toast.error('Auto-save failed');
      }
      setSaving(false);
    }, 800);
  }, [activeNote]);

  /* The notebook you are "inside": the open notebook itself, or the one
     the open page belongs to. Null on the landing shelf. */
  const currentNotebook = !activeNote
    ? null
    : activeNote.isNotebook
      ? activeNote
      : notebooks.find((nb) => String(nb._id) === String(activeNote.notebookId)) || null;

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  /* Landing view: nothing but the shelf of notebooks. */
  if (!activeNote) {
    return (
      <div className="notes-shelf">
        <div className="nb-gallery-head">
          <div>
            <h2>Your notebooks</h2>
            <p>{notebooks.length} notebook{notebooks.length === 1 ? '' : 's'} — tap one to open it.</p>
          </div>
          <button className="btn btn-primary" onClick={handleNewNotebook}>
            <Plus size={14} /> New notebook
          </button>
        </div>
        {notebooks.length === 0 ? (
          <div className="empty-state">
            <Book size={48} strokeWidth={1} />
            <h3>No notebooks yet</h3>
            <p>Create a notebook, then add pages inside it.</p>
          </div>
        ) : (
          <div className="nb-grid">
            {notebooks.map((nb, i) => {
              const nbPages = getNotebookPages(nb._id);
              return (
                <button
                  key={nb._id}
                  type="button"
                  className="nb-card"
                  style={{ '--nb-color': nb.color || `var(--chart-${(i % 5) + 1})` }}
                  onClick={() => openNotebook(nb)}
                >
                  <span className="nb-card-spine" />
                  <span className="nb-card-body">
                    <Book size={22} />
                    <strong>{nb.title || 'Untitled notebook'}</strong>
                    <em>{nbPages.length} page{nbPages.length === 1 ? '' : 's'}</em>
                    <small>Updated {formatDistanceToNow(new Date(nb.updatedAt || nb.createdAt), { addSuffix: true })}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {legacyNotes.length > 0 && (
          <>
            <h3 className="notes-shelf-sub">Loose notes</h3>
            <div className="notebook-page-list">
              {legacyNotes.map((note) => (
                <button key={note._id} className="notebook-page-btn" onClick={() => setActiveNote(note)}>
                  <FileText size={14} /> {note.title || 'Untitled'}
                </button>
              ))}
            </div>
          </>
        )}
        <ConfirmDialog
          open={!!deleteNoteId}
          title="Delete note?"
          message="This note and any child pages will be permanently removed."
          confirmLabel="Delete"
          danger
          onConfirm={() => { const id = deleteNoteId; setDeleteNoteId(null); handleDelete(id); }}
          onCancel={() => setDeleteNoteId(null)}
        />
      </div>
    );
  }

  const nbPagesList = currentNotebook ? getNotebookPages(currentNotebook._id) : [];

  return (
    <div className={`notes-layout ${currentNotebook ? '' : 'no-sidebar'}`}>
      {currentNotebook && (
        <button className="notes-sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? '✕' : '☰'} Pages
        </button>
      )}

      {currentNotebook && (
        <div className={`notes-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="notes-sidebar-header">
            <button
              type="button"
              className={`notes-nb-title ${activeNote._id === currentNotebook._id ? 'active' : ''}`}
              onClick={() => { setActiveNote(currentNotebook); setSidebarOpen(false); }}
            >
              <Book size={14} />
              <span>{currentNotebook.title || 'Untitled notebook'}</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => handleNewPage(currentNotebook)} title="New page">
              <Plus size={14} />
            </button>
          </div>
          <ul className="notes-tree">
            {nbPagesList.length === 0 && <li className="notes-list-empty">No pages yet</li>}
            {nbPagesList.map((p) => (
              <li
                key={p._id}
                className={`notes-tree-item ${activeNote._id === p._id ? 'active' : ''}`}
                onClick={() => { setActiveNote(p); setSidebarOpen(false); }}
              >
                <FileText size={13} />
                <span className="tree-label">{p.title || 'Untitled'}</span>
                {(p.tags || []).includes('learning-line') && <span className="learning-badge">💡</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="notes-editor">
        {(
          <>
            <div className="notes-editor-toolbar">
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveNote(null)} title="Back to all notebooks">
                <ArrowLeft size={13} /> All notebooks
              </button>
              <div className="notes-color-row">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`note-color-dot ${(activeNote.color || '') === c ? 'selected' : ''}`}
                    style={{ background: c || 'var(--bg-hover)', border: c ? `2px solid ${c}` : '2px solid var(--border-light)' }}
                    onClick={() => autoSave({ color: c })}
                  />
                ))}
              </div>
              <div className="notes-editor-actions">
                {activeNote.isNotebook && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleNewPage(activeNote)}>
                    <Plus size={13} /> New Page
                  </button>
                )}
                {saving && <span className="notes-saving">Saving...</span>}
                <button className="notes-delete-btn" onClick={() => setDeleteNoteId(activeNote._id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <input
              className="notes-title-input"
              value={activeNote.title}
              onChange={(e) => autoSave({ title: e.target.value })}
              placeholder={activeNote.isNotebook ? 'Notebook name...' : 'Page title...'}
            />

            {activeNote.isNotebook ? (
              <div className="notebook-overview">
                <p className="notebook-hint">
                  This notebook has {getNotebookPages(activeNote._id).length} page(s).
                  Click <strong>+ New Page</strong> to add content, or select a page from the sidebar.
                </p>
                <div className="notebook-page-list">
                  {getNotebookPages(activeNote._id).map((p) => (
                    <button key={p._id} className="notebook-page-btn" onClick={() => setActiveNote(p)}>
                      <FileText size={14} />
                      {p.title}
                      {(p.tags || []).includes('learning-line') && ' 💡'}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <BlockEditor
                blocks={activeNote.blocks?.length ? activeNote.blocks : [{ type: 'text', content: activeNote.content || '', order: 0 }]}
                onChange={(blocks) => autoSave({ blocks, content: blocks.filter((b) => b.type === 'text').map((b) => b.content).join('\n\n') })}
                onUploadImage={uploadNoteImage}
              />
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteNoteId}
        title="Delete note?"
        message="This note and any child pages will be permanently removed."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          const id = deleteNoteId;
          setDeleteNoteId(null);
          handleDelete(id);
        }}
        onCancel={() => setDeleteNoteId(null)}
      />
    </div>
  );
}
