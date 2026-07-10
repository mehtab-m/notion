import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Trash2, MoreHorizontal, X, Check, Type, Hash,
  Calendar, ChevronDown, Image, CheckSquare, Link, Pencil
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  addRow, updateRow, deleteRow, addColumn, updateColumn, deleteColumn,
} from '../../utils/api';
import ConfirmDialog from '../ConfirmDialog';
import './DynamicTable.css';

const TYPE_ICONS = {
  text: Type,
  number: Hash,
  date: Calendar,
  dropdown: ChevronDown,
  image: Image,
  checkbox: CheckSquare,
  url: Link,
};

const COLUMN_TYPES = ['text', 'number', 'date', 'dropdown', 'image', 'checkbox', 'url'];

const defaultTableApi = {
  addRow: (tableId, data) => addRow(tableId, data),
  updateRow: (tableId, rowId, data) => updateRow(tableId, rowId, data),
  deleteRow: (tableId, rowId) => deleteRow(tableId, rowId),
  addColumn: (tableId, col) => addColumn(tableId, col),
  updateColumn: (tableId, colId, data) => updateColumn(tableId, colId, data),
  deleteColumn: (tableId, colId) => deleteColumn(tableId, colId),
};

function AddColumnPanel({ tableId, tableApi, onAdded, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [options, setOptions] = useState([]);
  const [optInput, setOptInput] = useState('');
  const [loading, setLoading] = useState(false);

  const addOpt = () => {
    if (!optInput.trim()) return;
    setOptions((p) => [...p, optInput.trim()]);
    setOptInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Column name required'); return; }
    setLoading(true);
    try {
      const col = await tableApi.addColumn(tableId, { name: name.trim(), type, options });
      toast.success('Column added');
      onAdded(col);
      onClose();
    } catch (err) {
      toast.error('Failed to add column');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-col-panel">
      <div className="add-col-panel-header">
        <span>Add Column</span>
        <button onClick={onClose}><X size={14} /></button>
      </div>
      <form onSubmit={handleSubmit}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Column name..."
          autoFocus
          className="add-col-input"
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className="add-col-select">
          {COLUMN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {type === 'dropdown' && (
          <div className="add-col-options">
            <div className="add-col-opt-row">
              <input
                value={optInput}
                onChange={(e) => setOptInput(e.target.value)}
                placeholder="Add option..."
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOpt(); } }}
                className="add-col-input"
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={addOpt}>+</button>
            </div>
            <div className="dropdown-opts-preview">
              {options.map((o, i) => (
                <span key={i} className="dropdown-option-tag">
                  {o}
                  <button type="button" onClick={() => setOptions((p) => p.filter((_, ii) => ii !== i))}><X size={10} /></button>
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="add-col-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
            {loading ? '...' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ColMenu({ col, tableId, tableApi, onUpdated, onDeleted, onClose }) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(col.name);
  const [confirmDel, setConfirmDel] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRename = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await tableApi.updateColumn(tableId, col.id || col._id, { name: newName.trim() });
      onUpdated({ ...col, name: newName.trim() });
      toast.success('Column renamed');
      onClose();
    } catch {
      toast.error('Failed to rename');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await tableApi.deleteColumn(tableId, col.id || col._id);
      onDeleted(col.id || col._id);
      toast.success('Column deleted');
      onClose();
    } catch {
      toast.error('Failed to delete column');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="col-menu">
      {renaming ? (
        <div className="col-menu-rename">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') onClose(); }}
            className="col-menu-input"
          />
          <button className="btn btn-primary btn-sm" onClick={handleRename} disabled={loading}>
            <Check size={12} />
          </button>
        </div>
      ) : confirmDel ? (
        <div className="col-menu-confirm">
          <span>Delete "{col.name}"?</span>
          <div className="col-menu-confirm-btns">
            <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={loading}>
              {loading ? '...' : 'Delete'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDel(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <button className="col-menu-item" onClick={() => setRenaming(true)}>
            <Pencil size={13} /> Rename
          </button>
          <button className="col-menu-item danger" onClick={() => setConfirmDel(true)}>
            <Trash2 size={13} /> Delete Column
          </button>
        </>
      )}
    </div>
  );
}

function Cell({ col, value, tableId, rowId, onSave }) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value ?? (col.type === 'checkbox' ? false : ''));
  const inputRef = useRef(null);

  const save = async (val) => {
    if (val === value) { setEditing(false); return; }
    try {
      await onSave(cid(col), val);
    } catch {
      toast.error('Failed to save');
    }
    setEditing(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result;
      setLocalVal(b64);
      onSave(col.id, b64).catch(() => toast.error('Failed to save image'));
    };
    reader.readAsDataURL(file);
  };

  if (col.type === 'checkbox') {
    return (
      <td className="dt-cell dt-cell-checkbox">
        <input
          type="checkbox"
          checked={!!localVal}
          onChange={(e) => {
            const v = e.target.checked;
            setLocalVal(v);
            onSave(col.id, v);
          }}
        />
      </td>
    );
  }

  if (col.type === 'image') {
    return (
      <td className="dt-cell dt-cell-image">
        {localVal ? (
          <div className="cell-image-wrap">
            <img src={localVal} alt="" className="cell-thumbnail" />
            <label className="cell-image-replace">
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              Replace
            </label>
          </div>
        ) : (
          <label className="cell-image-upload">
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            <Plus size={14} /> Upload
          </label>
        )}
      </td>
    );
  }

  if (col.type === 'url' && !editing) {
    return (
      <td className="dt-cell" onClick={() => setEditing(true)}>
        {localVal ? (
          <a href={localVal} target="_blank" rel="noopener noreferrer" className="cell-link" onClick={(e) => e.stopPropagation()}>
            {localVal}
          </a>
        ) : (
          <span className="cell-empty">—</span>
        )}
      </td>
    );
  }

  if (col.type === 'dropdown') {
    return (
      <td className="dt-cell dt-cell-dropdown">
        <select
          value={localVal || ''}
          onChange={(e) => {
            setLocalVal(e.target.value);
            onSave(col.id, e.target.value);
          }}
          className="cell-select"
        >
          <option value="">—</option>
          {(col.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </td>
    );
  }

  if (!editing) {
    return (
      <td className="dt-cell" onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }}>
        {localVal !== '' && localVal != null ? (
          <span className="cell-value">{col.type === 'date' && localVal ? new Date(localVal).toLocaleDateString() : String(localVal)}</span>
        ) : (
          <span className="cell-empty">—</span>
        )}
      </td>
    );
  }

  return (
    <td className="dt-cell dt-cell-editing">
      <input
        ref={inputRef}
        type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={() => save(col.type === 'number' ? Number(localVal) : localVal)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save(col.type === 'number' ? Number(localVal) : localVal);
          if (e.key === 'Escape') { setLocalVal(value ?? ''); setEditing(false); }
        }}
        className="cell-input"
        autoFocus
      />
    </td>
  );
}

const rid = (item) => item?.id || item?._id;
const cid = (col) => col?.id || col?._id;

function normColumns(cols) {
  return (cols || []).map((c) => ({ ...c, id: cid(c) }));
}

function normRows(rows) {
  return (rows || []).map((r) => ({ ...r, id: rid(r) }));
}

export default function DynamicTable({ table, onTableChange, tableApi = defaultTableApi, hideName }) {
  const tableId = table._id || table.id;
  const [columns, setColumns] = useState(normColumns(table.columns));
  const [rows, setRows] = useState(normRows(table.rows));
  const [showAddCol, setShowAddCol] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [addingRow, setAddingRow] = useState(false);
  const [deletingCol, setDeletingCol] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    setColumns(normColumns(table.columns));
    setRows(normRows(table.rows));
  }, [table]);

  const handleAddRow = async () => {
    setAddingRow(true);
    try {
      const newRow = await tableApi.addRow(tableId, {});
      const normalized = { ...newRow, id: rid(newRow) };
      setRows((prev) => [...prev, normalized]);
      onTableChange?.();
    } catch {
      toast.error('Failed to add row');
    } finally {
      setAddingRow(false);
    }
  };

  const handleDeleteRow = async (rowId) => {
    try {
      await tableApi.deleteRow(tableId, rowId);
      setRows((prev) => prev.filter((r) => rid(r) !== rowId));
      toast.success('Row deleted');
      onTableChange?.();
    } catch {
      toast.error('Failed to delete row');
    }
  };

  const handleCellSave = async (rowId, colId, value) => {
    const row = rows.find((r) => rid(r) === rowId);
    if (!row) return;
    const newData = { ...row.data, [colId]: value };
    await tableApi.updateRow(tableId, rowId, newData);
    setRows((prev) => prev.map((r) => (rid(r) === rowId ? { ...r, data: newData } : r)));
  };

  const handleColAdded = (col) => {
    const normalized = { ...col, id: cid(col) };
    setColumns((prev) => [...prev, normalized]);
    if (onTableChange) onTableChange();
  };

  const handleColUpdated = (updatedCol) => {
    const id = cid(updatedCol);
    setColumns((prev) => prev.map((c) => (cid(c) === id ? { ...updatedCol, id } : c)));
  };

  const handleColDeleted = (colId) => {
    setColumns((prev) => prev.filter((c) => cid(c) !== colId));
    setRows((prev) => prev.map((r) => {
      const newData = { ...r.data };
      delete newData[colId];
      return { ...r, data: newData };
    }));
    setOpenMenu(null);
    onTableChange?.();
  };

  const handleDeleteColumn = async (col) => {
    const colId = cid(col);
    setDeletingCol(colId);
    try {
      await tableApi.deleteColumn(tableId, colId);
      handleColDeleted(colId);
      toast.success('Column deleted');
    } catch {
      toast.error('Failed to delete column');
    } finally {
      setDeletingCol(null);
    }
  };

  return (
    <div className="dynamic-table-wrap">
      <div className="dt-toolbar">
        {!hideName && <span className="dt-table-name">{table.name}</span>}
        <div className="dt-toolbar-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddCol((v) => !v)}>
            <Plus size={14} /> Add Column
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleAddRow} disabled={addingRow}>
            <Plus size={14} /> Add Row
          </button>
        </div>
      </div>

      {showAddCol && (
        <div className="add-col-panel-wrap">
          <AddColumnPanel
            tableId={tableId}
            tableApi={tableApi}
            onAdded={handleColAdded}
            onClose={() => setShowAddCol(false)}
          />
        </div>
      )}

      {columns.length === 0 ? (
        <div className="empty-state" style={{ minHeight: 200 }}>
          <p>No columns yet. Add a column to get started.</p>
        </div>
      ) : (
        <div className="dt-scroll">
          <table className="dt-table">
            <thead>
              <tr>
                <th className="dt-row-actions-th" />
                {columns.map((col) => {
                  const colId = cid(col);
                  const Icon = TYPE_ICONS[col.type] || Type;
                  return (
                    <th key={colId} className="dt-th">
                      <div className="dt-th-inner">
                        <Icon size={13} />
                        <span>{col.name}</span>
                        <button
                          type="button"
                          className="col-delete-btn"
                          onClick={() => setConfirmDelete({ type: 'column', col })}
                          disabled={deletingCol === colId}
                          title={`Delete column "${col.name}"`}
                        >
                          <Trash2 size={12} />
                        </button>
                        <button
                          type="button"
                          className="col-menu-trigger"
                          onClick={() => setOpenMenu(openMenu === colId ? null : colId)}
                          title="Column options"
                        >
                          <MoreHorizontal size={13} />
                        </button>
                      </div>
                      {openMenu === colId && (
                        <div className="col-menu-wrap">
                          <ColMenu
                            col={col}
                            tableId={tableId}
                            tableApi={tableApi}
                            onUpdated={handleColUpdated}
                            onDeleted={handleColDeleted}
                            onClose={() => setOpenMenu(null)}
                          />
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="dt-empty-row">
                    No rows yet. Click "+ Add Row" to start.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const rowId = rid(row);
                  return (
                  <tr key={rowId} className="dt-row">
                    <td className="dt-row-delete-cell">
                      <button
                        className="dt-row-delete"
                        onClick={() => setConfirmDelete({ type: 'row', rowId })}
                        title="Delete row"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                    {columns.map((col) => (
                      <Cell
                        key={cid(col)}
                        col={col}
                        value={row.data?.[cid(col)]}
                        tableId={tableId}
                        rowId={rowId}
                        onSave={(colId, val) => handleCellSave(rowId, colId, val)}
                      />
                    ))}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === 'column' ? 'Delete column?' : 'Delete row?'}
        message={
          confirmDelete?.type === 'column'
            ? `Column "${confirmDelete.col?.name}" and all its data will be permanently removed.`
            : 'This row and all its data will be permanently removed.'
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          const action = confirmDelete;
          setConfirmDelete(null);
          if (action?.type === 'row') handleDeleteRow(action.rowId);
          else if (action?.type === 'column') handleDeleteColumn(action.col);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
