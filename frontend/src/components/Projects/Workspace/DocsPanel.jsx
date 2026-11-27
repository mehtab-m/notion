import React, { useMemo, useState } from 'react';
import { FileText, Plus, Pencil, Trash2, Save, Eye, AlertTriangle, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { createProjectItem, updateProjectItem, deleteProjectItem } from '../../../utils/api';
import ConfirmDialog from '../../ConfirmDialog';
import { DOC_CATEGORIES, looksSecret, prettify } from './config';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

/** Small, dependency-free markdown → HTML. Input is escaped first, so it is safe to inject. */
export function renderMarkdown(md) {
  const lines = esc(String(md || '')).split('\n');
  const out = [];
  let inCode = false;
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    if (raw.trim().startsWith('```')) {
      closeList();
      out.push(inCode ? '</code></pre>' : '<pre><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(`${raw}\n`); continue; }
    const h = raw.match(/^(#{1,4})\s+(.*)$/);
    const ul = raw.match(/^\s*[-*]\s+(?:\[( |x)\]\s+)?(.*)$/);
    const ol = raw.match(/^\s*\d+\.\s+(.*)$/);
    if (h) { closeList(); out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); }
    else if (ul) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      const box = ul[1] != null ? `<input type="checkbox" disabled ${ul[1] === 'x' ? 'checked' : ''}/> ` : '';
      out.push(`<li>${box}${inline(ul[2])}</li>`);
    } else if (ol) {
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(ol[1])}</li>`);
    } else if (/^&gt;\s?/.test(raw)) { closeList(); out.push(`<blockquote>${inline(raw.replace(/^&gt;\s?/, ''))}</blockquote>`); }
    else if (/^---+$/.test(raw.trim())) { closeList(); out.push('<hr/>'); }
    else if (!raw.trim()) { closeList(); }
    else { closeList(); out.push(`<p>${inline(raw)}</p>`); }
  }
  closeList();
  if (inCode) out.push('</code></pre>');
  return out.join('');
}

const TEMPLATES = {
  setup: '# Local setup\n\n## Prerequisites\n- Node 20\n\n## Steps\n1. Clone the repo\n2. `npm install`\n3. Copy `.env.example` → `.env` (values from the vault)\n4. `npm run dev`\n',
  adr: '# ADR: <decision>\n\n## Context\n\n## Decision\n\n## Consequences\n',
  troubleshooting: '# Troubleshooting: <symptom>\n\n## Symptom\n\n## Cause\n\n## Fix\n```\n\n```\n',
  deployment: '# Deployment\n\n## Where\n\n## How\n1. \n\n## Rollback\n',
};

function DocEditor({ doc, workspace, tasks, onCancel, onSave, saving }) {
  const [form, setForm] = useState({
    title: doc?.title || '', category: doc?.category || 'general', summary: doc?.summary || '',
    content: doc?.content || '', repositoryId: doc?.repositoryId || '', environmentId: doc?.environmentId || '',
    taskIds: doc?.taskIds || [],
  });
  const [preview, setPreview] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const secret = looksSecret(form.content) || looksSecret(form.summary) || looksSecret(form.title);

  return (
    <div className="ws-doc-editor">
      <div className="ws-form-grid">
        <div className="ws-field wide"><label>Title *</label><input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="How to run locally" /></div>
        <div className="ws-field">
          <label>Category</label>
          <select value={form.category} onChange={(e) => {
            const c = e.target.value;
            set('category', c);
            if (!form.content.trim() && TEMPLATES[c]) set('content', TEMPLATES[c]);
          }}>
            {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{prettify(c)}</option>)}
          </select>
        </div>
        <div className="ws-field"><label>Summary</label><input value={form.summary} onChange={(e) => set('summary', e.target.value)} /></div>
        <div className="ws-field">
          <label>Repository</label>
          <select value={form.repositoryId} onChange={(e) => set('repositoryId', e.target.value)}>
            <option value="">None</option>
            {(workspace.repositories || []).map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
          </select>
        </div>
        <div className="ws-field">
          <label>Environment</label>
          <select value={form.environmentId} onChange={(e) => set('environmentId', e.target.value)}>
            <option value="">None</option>
            {(workspace.environments || []).map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
          </select>
        </div>
        {tasks.length > 0 && (
          <div className="ws-field wide">
            <label>Linked tasks</label>
            <div className="ws-chips">
              {tasks.map((t) => {
                const on = form.taskIds.includes(t.id);
                return (
                  <button key={t.id} type="button" className={`ws-chip ws-chip-toggle ${on ? 'on' : ''}`}
                    onClick={() => set('taskIds', on ? form.taskIds.filter((x) => x !== t.id) : [...form.taskIds, t.id])}>
                    {t.text}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="ws-doc-toolbar">
        <button type="button" className={`filter-btn ${!preview ? 'active' : ''}`} onClick={() => setPreview(false)}><Pencil size={12} /> Write</button>
        <button type="button" className={`filter-btn ${preview ? 'active' : ''}`} onClick={() => setPreview(true)}><Eye size={12} /> Preview</button>
        <span className="ws-muted">Markdown · use $VAR placeholders, never secret values</span>
      </div>
      {preview ? (
        <div className="ws-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) || '<p class="ws-muted">Nothing yet</p>' }} />
      ) : (
        <textarea className="ws-mono ws-doc-text" rows={16} value={form.content} onChange={(e) => set('content', e.target.value)} spellCheck={false} />
      )}
      {secret && <div className="ws-secret-warn"><AlertTriangle size={14} /> This looks like it contains a secret value — the server will refuse it.</div>}
      <div className="ws-form-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={saving}
          onClick={() => (form.title.trim() ? onSave(form) : toast.error('Title is required'))}>
          <Save size={13} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function DocsPanel({ projectId, workspace, tasks = [], canEdit = true, onChanged }) {
  const docs = workspace.documents || [];
  const [mode, setMode] = useState(null); // null | 'new' | {edit: doc} | {view: doc}
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState('all');
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const visible = useMemo(() => docs
    .filter((d) => showArchived || !d.archivedAt)
    .filter((d) => category === 'all' || d.category === category)
    .filter((d) => !q.trim() || `${d.title} ${d.summary} ${d.content}`.toLowerCase().includes(q.trim().toLowerCase())), [docs, category, q, showArchived]);

  const save = async (form) => {
    setSaving(true);
    try {
      const payload = { ...form, repositoryId: form.repositoryId || null, environmentId: form.environmentId || null };
      if (mode === 'new') {
        const created = await createProjectItem(projectId, 'documents', payload);
        onChanged('documents', [created, ...docs]);
        setMode({ view: created });
      } else {
        const updated = await updateProjectItem(projectId, 'documents', mode.edit._id, payload);
        onChanged('documents', docs.map((d) => (d._id === updated._id ? updated : d)));
        setMode({ view: updated });
      }
      toast.success('Document saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save');
    } finally { setSaving(false); }
  };

  const archive = async (doc) => {
    try {
      const updated = await updateProjectItem(projectId, 'documents', doc._id, { archivedAt: doc.archivedAt ? null : new Date().toISOString() });
      onChanged('documents', docs.map((d) => (d._id === updated._id ? updated : d)));
      setMode(null);
    } catch { toast.error('Failed'); }
  };

  const remove = async (doc) => {
    try {
      await deleteProjectItem(projectId, 'documents', doc._id);
      onChanged('documents', docs.filter((d) => d._id !== doc._id));
      setMode(null);
    } catch { toast.error('Failed'); }
  };

  if (mode === 'new' || mode?.edit) {
    return (
      <section className="pd-section">
        <div className="pd-panel-title"><FileText size={16} /><h3>{mode === 'new' ? 'New document' : 'Edit document'}</h3></div>
        <DocEditor doc={mode?.edit} workspace={workspace} tasks={tasks} onCancel={() => setMode(mode?.edit ? { view: mode.edit } : null)} onSave={save} saving={saving} />
      </section>
    );
  }

  if (mode?.view) {
    const d = docs.find((x) => x._id === mode.view._id) || mode.view;
    const repo = workspace.repositories?.find((r) => r._id === d.repositoryId);
    const env = workspace.environments?.find((r) => r._id === d.environmentId);
    const linked = tasks.filter((t) => (d.taskIds || []).includes(t.id));
    return (
      <section className="pd-section">
        <div className="pd-panel-title ws-title">
          <button type="button" className="pd-icon-btn" onClick={() => setMode(null)}><ArrowLeft size={14} /></button>
          <h3>{d.title}</h3>
          <div className="ws-title-actions">
            {canEdit && <button type="button" className="btn btn-secondary btn-sm" onClick={() => archive(d)}>{d.archivedAt ? 'Restore' : 'Archive'}</button>}
            {canEdit && <button type="button" className="btn btn-primary btn-sm" onClick={() => setMode({ edit: d })}><Pencil size={13} /> Edit</button>}
            {canEdit && <button type="button" className="pd-icon-btn danger" onClick={() => setConfirm(d)}><Trash2 size={13} /></button>}
          </div>
        </div>
        <div className="ws-chips" style={{ marginBottom: 12 }}>
          <span className="ws-chip">{prettify(d.category)}</span>
          {repo && <span className="ws-chip">repo · {repo.name}</span>}
          {env && <span className="ws-chip">env · {env.name}</span>}
          {linked.map((t) => <span key={t.id} className="ws-chip">task · {t.text}</span>)}
          <span className="ws-muted">updated {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}</span>
        </div>
        {d.summary && <p className="ws-summary">{d.summary}</p>}
        <div className="ws-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(d.content) || '<p class="ws-muted">Empty document</p>' }} />
        <ConfirmDialog open={!!confirm} title="Delete document?" message="This document will be permanently removed." confirmLabel="Delete" danger
          onConfirm={() => { const it = confirm; setConfirm(null); remove(it); }} onCancel={() => setConfirm(null)} />
      </section>
    );
  }

  return (
    <section className="pd-section">
      <div className="pd-panel-title ws-title">
        <FileText size={16} />
        <h3>Knowledge</h3>
        <span className="pd-nav-count">{docs.filter((d) => !d.archivedAt).length}</span>
        <div className="ws-title-actions">
          <input className="ws-filter" placeholder="Search docs…" value={q} onChange={(e) => setQ(e.target.value)} />
          {canEdit && <button type="button" className="btn btn-primary btn-sm" onClick={() => setMode('new')}><Plus size={14} /> New doc</button>}
        </div>
      </div>
      <div className="pd-table-presets">
        {['all', ...DOC_CATEGORIES].map((c) => (
          <button key={c} type="button" className={`filter-btn ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{prettify(c)}</button>
        ))}
        <label className="ws-check" style={{ marginLeft: 'auto' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archived
        </label>
      </div>
      {visible.length === 0 ? (
        <div className="pd-empty"><FileText size={36} strokeWidth={1} /><p>No documents — capture setup steps, runbooks and decisions here.</p></div>
      ) : (
        <div className="ws-doc-grid">
          {visible.map((d) => (
            <button key={d._id} type="button" className={`ws-doc-card ${d.archivedAt ? 'archived' : ''}`} onClick={() => setMode({ view: d })}>
              <span className="ws-chip">{prettify(d.category)}</span>
              <strong>{d.title}</strong>
              {d.summary && <em>{d.summary}</em>}
              <span className="ws-muted">{formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
