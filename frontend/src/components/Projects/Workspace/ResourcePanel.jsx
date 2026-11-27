import React, { useState } from 'react';
import { Plus, Pencil, Trash2, ExternalLink, Copy, AlertTriangle, ChevronDown, ChevronRight, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { createProjectItem, updateProjectItem, deleteProjectItem } from '../../../utils/api';
import ConfirmDialog from '../../ConfirmDialog';
import { RESOURCE_SCHEMAS, VAR_STATUSES, looksSecret, prettify, isUrl } from './config';

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

function emptyFor(schema) {
  const out = {};
  schema.fields.forEach((f) => {
    if (f.type === 'bool') out[f.key] = false;
    else if (f.type === 'vars' || f.type === 'instances') out[f.key] = [];
    else if (f.type === 'kv') out[f.key] = {};
    else if (f.type === 'repo' || f.type === 'env') out[f.key] = '';
    else out[f.key] = f.def ?? '';
  });
  return out;
}

const kvToText = (obj) => Object.entries(obj || {}).map(([k, v]) => `${k}=${v}`).join('\n');
const textToKv = (text) => Object.fromEntries(
  String(text || '').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => { const i = l.indexOf('='); return i === -1 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
    .filter(([k]) => k),
);

export function copyText(text) {
  navigator.clipboard?.writeText(text).then(() => toast.success('Copied')).catch(() => toast.error('Copy failed'));
}

function VarsEditor({ value, onChange }) {
  const rows = Array.isArray(value) ? value : [];
  const set = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div className="ws-rows">
      {rows.map((r, i) => (
        <div key={r.id || i} className="ws-row ws-row-vars">
          <input className="ws-mono" value={r.name || ''} placeholder="DATABASE_URL"
            onChange={(e) => set(i, { name: e.target.value.replace(/[^A-Za-z0-9_]/g, '').toUpperCase() })} />
          <select value={r.status || 'unknown'} onChange={(e) => set(i, { status: e.target.value })}>
            {VAR_STATUSES.map((s) => <option key={s} value={s}>{prettify(s)}</option>)}
          </select>
          <input value={r.secretRef || ''} placeholder="Where it lives (Doppler: prod/DB_URL)"
            onChange={(e) => set(i, { secretRef: e.target.value })} />
          <label className="ws-check"><input type="checkbox" checked={r.isRequired !== false} onChange={(e) => set(i, { isRequired: e.target.checked })} /> Req.</label>
          <button type="button" className="pd-icon-btn danger" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}><X size={13} /></button>
        </div>
      ))}
      <button type="button" className="ws-link-btn" onClick={() => onChange([...rows, { id: newId(), name: '', status: 'unknown', isRequired: true, secretRef: '' }])}>
        <Plus size={13} /> Add variable
      </button>
      <p className="ws-hint">Names and where the secret is stored only — never paste values.</p>
    </div>
  );
}

function InstancesEditor({ value, onChange, environments }) {
  const rows = Array.isArray(value) ? value : [];
  const set = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div className="ws-rows">
      {rows.map((r, i) => (
        <div key={r.id || i} className="ws-row ws-row-inst">
          <select value={r.environmentId || ''} onChange={(e) => set(i, { environmentId: e.target.value })}>
            <option value="">Environment…</option>
            {environments.map((env) => <option key={env._id} value={env._id}>{env.name}</option>)}
          </select>
          <input value={r.resourceName || ''} placeholder="Resource name" onChange={(e) => set(i, { resourceName: e.target.value })} />
          <input value={r.region || ''} placeholder="Region" onChange={(e) => set(i, { region: e.target.value })} />
          <input value={r.endpoint || ''} placeholder="Endpoint / host" onChange={(e) => set(i, { endpoint: e.target.value })} />
          <select value={r.status || 'active'} onChange={(e) => set(i, { status: e.target.value })}>
            {['active', 'inactive', 'maintenance', 'unknown'].map((s) => <option key={s} value={s}>{prettify(s)}</option>)}
          </select>
          <button type="button" className="pd-icon-btn danger" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}><X size={13} /></button>
        </div>
      ))}
      <button type="button" className="ws-link-btn" onClick={() => onChange([...rows, { id: newId(), environmentId: '', status: 'active' }])}>
        <Plus size={13} /> Add instance
      </button>
    </div>
  );
}

function ItemForm({ schema, initial, workspace, onCancel, onSave, saving }) {
  const [form, setForm] = useState(() => ({ ...emptyFor(schema), ...(initial || {}) }));
  const [kvText, setKvText] = useState(() => {
    const out = {};
    schema.fields.filter((f) => f.type === 'kv').forEach((f) => { out[f.key] = kvToText(initial?.[f.key]); });
    return out;
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const secretFields = schema.fields.filter((f) => looksSecret(f.type === 'kv' ? kvText[f.key] : form[f.key]));

  const submit = (e) => {
    e.preventDefault();
    const missing = schema.fields.find((f) => f.required && !String(form[f.key] || '').trim());
    if (missing) { toast.error(`${missing.label} is required`); return; }
    const data = {};
    schema.fields.forEach((f) => {
      if (f.type === 'kv') data[f.key] = textToKv(kvText[f.key]);
      else if (f.type === 'vars') data[f.key] = (form[f.key] || []).filter((r) => r.name);
      else data[f.key] = form[f.key];
    });
    onSave(data);
  };

  return (
    <form className="ws-form" onSubmit={submit}>
      <div className="ws-form-grid">
        {schema.fields.map((f) => {
          const wide = ['textarea', 'code', 'vars', 'kv', 'instances'].includes(f.type);
          let input;
          switch (f.type) {
            case 'textarea':
              input = <textarea rows={3} value={form[f.key] || ''} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />;
              break;
            case 'code':
              input = <textarea rows={3} className="ws-mono" value={form[f.key] || ''} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} spellCheck={false} />;
              break;
            case 'kv':
              input = <textarea rows={3} className="ws-mono" value={kvText[f.key] || ''} placeholder={f.placeholder} onChange={(e) => setKvText((p) => ({ ...p, [f.key]: e.target.value }))} />;
              break;
            case 'select':
              input = (
                <select value={form[f.key] || f.def} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              );
              break;
            case 'repo':
            case 'env': {
              const list = f.type === 'repo' ? workspace.repositories : workspace.environments;
              input = (
                <select value={form[f.key] || ''} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">None</option>
                  {(list || []).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                </select>
              );
              break;
            }
            case 'bool':
              input = <label className="ws-check"><input type="checkbox" checked={!!form[f.key]} onChange={(e) => set(f.key, e.target.checked)} /> {f.label}</label>;
              break;
            case 'vars':
              input = <VarsEditor value={form[f.key]} onChange={(v) => set(f.key, v)} />;
              break;
            case 'instances':
              input = <InstancesEditor value={form[f.key]} onChange={(v) => set(f.key, v)} environments={workspace.environments || []} />;
              break;
            default:
              input = <input className={f.mono ? 'ws-mono' : ''} type={f.type === 'url' ? 'text' : 'text'} value={form[f.key] || ''} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />;
          }
          return (
            <div key={f.key} className={`ws-field ${wide ? 'wide' : ''}`}>
              {f.type !== 'bool' && <label>{f.label}{f.required && ' *'}</label>}
              {input}
            </div>
          );
        })}
      </div>
      {secretFields.length > 0 && (
        <div className="ws-secret-warn"><AlertTriangle size={14} /> {secretFields.map((f) => f.label).join(', ')} looks like a secret value. Store where it lives instead.</div>
      )}
      <div className="ws-form-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}><Save size={13} /> {saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

function FieldValue({ field, value, workspace }) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length) || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length)) return null;
  let body;
  if (field.type === 'url' && isUrl(value)) body = <a href={value} target="_blank" rel="noreferrer">{value} <ExternalLink size={11} /></a>;
  else if (field.type === 'select') body = prettify(value);
  else if (field.type === 'bool') body = value ? 'Yes' : 'No';
  else if (field.type === 'repo') body = workspace.repositories?.find((r) => r._id === value)?.name || '—';
  else if (field.type === 'env') body = workspace.environments?.find((r) => r._id === value)?.name || '—';
  else if (field.type === 'kv') body = <span className="ws-chips">{Object.entries(value).map(([k, v]) => <span key={k} className="ws-chip ws-mono">{k} {v}</span>)}</span>;
  else if (field.type === 'vars') {
    body = (
      <div className="ws-var-list">
        {value.map((v) => (
          <div key={v.id || v.name} className="ws-var">
            <code>{v.name}</code>
            <span className={`ws-var-status s-${v.status || 'unknown'}`}>{prettify(v.status || 'unknown')}</span>
            {v.isRequired === false && <span className="ws-muted">optional</span>}
            {v.secretRef && <span className="ws-muted">→ {v.secretRef}</span>}
          </div>
        ))}
      </div>
    );
  } else if (field.type === 'instances') {
    body = (
      <div className="ws-var-list">
        {value.map((v) => (
          <div key={v.id} className="ws-var">
            <strong>{workspace.environments?.find((e) => e._id === v.environmentId)?.name || 'Any'}</strong>
            {v.resourceName && <span>{v.resourceName}</span>}
            {v.region && <span className="ws-muted">{v.region}</span>}
            {v.endpoint && <code>{v.endpoint}</code>}
            <span className={`ws-var-status s-${v.status === 'active' ? 'configured' : 'unknown'}`}>{prettify(v.status)}</span>
          </div>
        ))}
      </div>
    );
  } else if (field.type === 'code') body = null;
  else body = <span className={field.mono ? 'ws-mono' : ''} style={{ whiteSpace: 'pre-wrap' }}>{String(value)}</span>;
  if (body == null) return null;
  return (
    <div className="ws-kv-row">
      <span className="ws-kv-label">{field.label}</span>
      <div className="ws-kv-value">{body}</div>
    </div>
  );
}

/** Generic list + form for one workspace resource kind. */
export default function ResourcePanel({ projectId, kind, workspace, canEdit = true, onChanged, icon: Icon, compact = false }) {
  const schema = RESOURCE_SCHEMAS[kind];
  const items = workspace[kind] || [];
  const [editing, setEditing] = useState(null); // 'new' | item
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [filter, setFilter] = useState('');

  const save = async (data) => {
    setSaving(true);
    try {
      if (editing === 'new') {
        const created = await createProjectItem(projectId, kind, data);
        onChanged(kind, [...items, created]);
        toast.success(`${prettify(schema.singular)} added`);
      } else {
        const updated = await updateProjectItem(projectId, kind, editing._id, data);
        onChanged(kind, items.map((x) => (x._id === updated._id ? updated : x)));
        toast.success('Saved');
      }
      setEditing(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    try {
      await deleteProjectItem(projectId, kind, item._id);
      onChanged(kind, items.filter((x) => x._id !== item._id));
      toast.success('Removed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete');
    }
  };

  const q = filter.trim().toLowerCase();
  const visible = q ? items.filter((x) => JSON.stringify(x).toLowerCase().includes(q)) : items;
  const codeField = schema.fields.find((f) => f.type === 'code');

  return (
    <section className={compact ? 'ws-sub' : 'pd-section'}>
      <div className="pd-panel-title ws-title">
        {Icon && <Icon size={16} />}
        <h3>{schema.title}</h3>
        <span className="pd-nav-count">{items.length}</span>
        <div className="ws-title-actions">
          {items.length > 5 && <input className="ws-filter" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />}
          {canEdit && editing !== 'new' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={14} /> Add</button>
          )}
        </div>
      </div>

      {editing === 'new' && (
        <ItemForm schema={schema} workspace={workspace} onCancel={() => setEditing(null)} onSave={save} saving={saving} />
      )}

      {visible.length === 0 && editing !== 'new' ? (
        <div className="pd-empty ws-empty"><p>No {schema.title.toLowerCase()} yet</p></div>
      ) : (
        <div className="ws-list">
          {visible.map((item) => {
            if (editing && editing !== 'new' && editing._id === item._id) {
              return <ItemForm key={item._id} schema={schema} initial={item} workspace={workspace} onCancel={() => setEditing(null)} onSave={save} saving={saving} />;
            }
            const expanded = !!open[item._id];
            return (
              <article key={item._id} className="ws-card">
                <header className="ws-card-head">
                  <button type="button" className="ws-expand" onClick={() => setOpen((p) => ({ ...p, [item._id]: !expanded }))}>
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <strong>{item[schema.titleKey]}</strong>
                  </button>
                  <div className="ws-chips">
                    {schema.subtitleKeys.map((k) => item[k] ? <span key={k} className="ws-chip">{prettify(item[k])}</span> : null)}
                    {item.isDestructive && <span className="ws-chip ws-chip-danger"><AlertTriangle size={11} /> Destructive</span>}
                    {kind === 'environments' && (item.variables || []).some((v) => v.status === 'missing') && (
                      <span className="ws-chip ws-chip-danger">{(item.variables || []).filter((v) => v.status === 'missing').length} missing vars</span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="ws-card-actions">
                      <button type="button" className="pd-icon-btn" onClick={() => setEditing(item)} title="Edit"><Pencil size={13} /></button>
                      <button type="button" className="pd-icon-btn danger" onClick={() => setConfirm(item)} title="Delete"><Trash2 size={13} /></button>
                    </div>
                  )}
                </header>
                {codeField && item[codeField.key] && (
                  <div className="ws-code">
                    <pre>{item[codeField.key]}</pre>
                    <button type="button" className="pd-icon-btn" onClick={() => copyText(item[codeField.key])} title="Copy"><Copy size={13} /></button>
                  </div>
                )}
                {expanded && (
                  <div className="ws-kv">
                    {schema.fields.filter((f) => f.key !== schema.titleKey).map((f) => (
                      <FieldValue key={f.key} field={f} value={item[f.key]} workspace={workspace} />
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={`Delete ${schema.singular}?`}
        message={`"${confirm?.[schema.titleKey]}" will be removed from this project.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => { const it = confirm; setConfirm(null); remove(it); }}
        onCancel={() => setConfirm(null)}
      />
    </section>
  );
}
