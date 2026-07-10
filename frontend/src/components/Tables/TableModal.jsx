import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createTable } from '../../utils/api';
import './TableModal.css';

const COLUMN_TYPES = ['text', 'number', 'date', 'dropdown', 'image', 'checkbox', 'url'];

const newColumn = () => ({ id: crypto.randomUUID(), name: '', type: 'text', options: [], optionInput: '' });

export default function TableModal({ onClose, onSaved }) {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState([newColumn()]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const updateColumn = (idx, field, value) => {
    setColumns((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const addOption = (idx) => {
    const col = columns[idx];
    if (!col.optionInput.trim()) return;
    setColumns((prev) =>
      prev.map((c, i) => i === idx
        ? { ...c, options: [...c.options, c.optionInput.trim()], optionInput: '' }
        : c
      )
    );
  };

  const removeOption = (colIdx, optIdx) => {
    setColumns((prev) =>
      prev.map((c, i) => i === colIdx ? { ...c, options: c.options.filter((_, oi) => oi !== optIdx) } : c)
    );
  };

  const removeColumn = (idx) => {
    setColumns((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tableName.trim()) { toast.error('Table name is required'); return; }
    const validCols = columns.filter((c) => c.name.trim());
    setLoading(true);
    try {
      const created = await createTable({
        name: tableName.trim(),
        columns: validCols.map(({ id, name, type, options }) => ({ id, name, type, options })),
      });
      toast.success('Table created!');
      onSaved(created);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create table');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card table-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Table</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Table Name *</label>
            <input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. Tasks, Recipes, Inventory..."
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Columns</label>
            <div className="columns-builder">
              {columns.map((col, idx) => (
                <div key={col.id} className="column-row">
                  <input
                    className="col-name-input"
                    value={col.name}
                    onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                    placeholder="Column name..."
                  />
                  <select
                    className="col-type-select"
                    value={col.type}
                    onChange={(e) => updateColumn(idx, 'type', e.target.value)}
                  >
                    {COLUMN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button type="button" className="col-remove-btn" onClick={() => removeColumn(idx)} disabled={columns.length === 1}>
                    <Trash2 size={14} />
                  </button>
                  {col.type === 'dropdown' && (
                    <div className="dropdown-options">
                      <div className="dropdown-option-input">
                        <input
                          value={col.optionInput}
                          onChange={(e) => updateColumn(idx, 'optionInput', e.target.value)}
                          placeholder="Add option..."
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(idx); } }}
                        />
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addOption(idx)}>
                          Add
                        </button>
                      </div>
                      <div className="dropdown-options-list">
                        {col.options.map((opt, oi) => (
                          <span key={oi} className="dropdown-option-tag">
                            {opt}
                            <button type="button" onClick={() => removeOption(idx, oi)}><X size={10} /></button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm add-col-btn"
                onClick={() => setColumns((prev) => [...prev, newColumn()])}
              >
                <Plus size={14} /> Add Column
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Table'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
