import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Table, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import useApi from '../hooks/useApi';
import { getTables, getTable, deleteTable, createTable } from '../utils/api';
import TableModal from '../components/Tables/TableModal';
import TableBoard from '../components/Tables/TableBoard';
import {
  addRow, updateRow, deleteRow, addColumn, updateColumn, deleteColumn,
} from '../utils/api';
import './TablesPage.css';

const TEMPLATES = [
  {
    name: 'Subscription Tracker',
    columns: [
      { name: 'Service', type: 'text' },
      { name: 'Cost / Month', type: 'number' },
      { name: 'Billing Cycle', type: 'dropdown', options: ['Monthly', 'Yearly', 'Weekly'] },
      { name: 'Category', type: 'dropdown', options: ['Entertainment', 'SaaS', 'Cloud', 'Fitness', 'Food', 'Other'] },
      { name: 'Renewal Date', type: 'date' },
      { name: 'Status', type: 'dropdown', options: ['Active', 'Paused', 'Cancelled'] },
      { name: 'Website', type: 'url' },
      { name: 'Notes', type: 'text' },
    ],
  },
  {
    name: 'Weekly Tasks',
    columns: [
      { name: 'Task', type: 'text' },
      { name: 'Priority', type: 'dropdown', options: ['High', 'Medium', 'Low'] },
      { name: 'Status', type: 'dropdown', options: ['To Do', 'In Progress', 'Done', 'Blocked'] },
      { name: 'Due Date', type: 'date' },
      { name: 'Assignee', type: 'text' },
      { name: 'Done', type: 'checkbox' },
      { name: 'Notes', type: 'text' },
    ],
  },
  {
    name: 'Budget Tracker',
    columns: [
      { name: 'Item', type: 'text' },
      { name: 'Amount', type: 'number' },
      { name: 'Category', type: 'dropdown', options: ['Food', 'Rent', 'Transport', 'Health', 'Entertainment', 'Other'] },
      { name: 'Type', type: 'dropdown', options: ['Income', 'Expense'] },
      { name: 'Date', type: 'date' },
      { name: 'Recurring', type: 'checkbox' },
      { name: 'Notes', type: 'text' },
    ],
  },
  {
    name: 'Contact List',
    columns: [
      { name: 'Name', type: 'text' },
      { name: 'Email', type: 'url' },
      { name: 'Phone', type: 'text' },
      { name: 'Company', type: 'text' },
      { name: 'Role', type: 'text' },
      { name: 'Last Contact', type: 'date' },
      { name: 'Notes', type: 'text' },
    ],
  },
];

function makeTableApi(tableId) {
  return {
    addRow: (_id, data) => addRow(tableId, data),
    updateRow: (_id, rowId, data) => updateRow(tableId, rowId, data),
    deleteRow: (_id, rowId) => deleteRow(tableId, rowId),
    addColumn: (_id, col) => addColumn(tableId, col),
    updateColumn: (_id, colId, data) => updateColumn(tableId, colId, data),
    deleteColumn: (_id, colId) => deleteColumn(tableId, colId),
  };
}

export default function TablesPage() {
  const { id: highlightId } = useParams();
  const navigate = useNavigate();
  const { data: tableList, loading: listLoading, refetch } = useApi(getTables);
  const [fullTables, setFullTables] = useState([]);
  const [loadingFull, setLoadingFull] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [highlightTableId, setHighlightTableId] = useState(highlightId || null);

  useEffect(() => {
    if (highlightId) {
      setHighlightTableId(highlightId);
      navigate('/tables', { replace: true });
    }
  }, [highlightId, navigate]);

  const loadFullTables = useCallback(async () => {
    if (!tableList?.length) {
      setFullTables([]);
      return;
    }
    setLoadingFull(true);
    try {
      const full = await Promise.all(tableList.map((t) => getTable(t._id)));
      setFullTables(full);
    } catch {
      toast.error('Failed to load table data');
    } finally {
      setLoadingFull(false);
    }
  }, [tableList]);

  useEffect(() => {
    loadFullTables();
  }, [loadFullTables]);

  const refreshTable = useCallback(async (tableId) => {
    try {
      const updated = await getTable(tableId);
      setFullTables((prev) => prev.map((t) => ((t._id || t.id) === tableId ? updated : t)));
      refetch();
    } catch {
      toast.error('Failed to refresh table');
    }
  }, [refetch]);

  const handleDelete = async (tableId) => {
    if (!window.confirm('Delete this table and all its data?')) return;
    try {
      await deleteTable(tableId);
      toast.success('Table deleted');
      refetch();
      setFullTables((prev) => prev.filter((t) => (t._id || t.id) !== tableId));
    } catch {
      toast.error('Failed to delete table');
    }
  };

  const handleTemplate = async (tpl) => {
    setCreatingTemplate(true);
    try {
      const cols = tpl.columns.map((c) => ({ id: crypto.randomUUID(), ...c, options: c.options || [] }));
      const created = await createTable({ name: tpl.name, columns: cols });
      toast.success(`"${tpl.name}" table created!`);
      setHighlightTableId(created._id);
      await refetch();
      const full = await getTable(created._id);
      setFullTables((prev) => [...prev, full]);
    } catch {
      toast.error('Failed to create template');
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleClose = useCallback(() => setModalOpen(false), []);

  const handleModalSaved = async (created) => {
    await refetch();
    setModalOpen(false);
    if (created?._id) {
      setHighlightTableId(created._id);
      const full = await getTable(created._id);
      setFullTables((prev) => [...prev.filter((t) => t._id !== created._id), full]);
    }
  };

  const loading = listLoading || loadingFull;
  const isEmpty = !loading && (!tableList || tableList.length === 0);

  return (
    <div className="tables-page">
      <div className="page-header">
        <div>
          <h1>Tables</h1>
          <p className="tables-page-subtitle">All your boards on one page — expand, edit rows & columns inline</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New Table
        </button>
      </div>

      <div className="table-templates">
        <span className="table-templates-label"><Zap size={13} /> Quick Templates:</span>
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.name}
            className="table-template-btn"
            onClick={() => handleTemplate(tpl)}
            disabled={creatingTemplate}
          >
            {tpl.name}
          </button>
        ))}
      </div>

      {isEmpty ? (
        <div className="empty-state">
          <Table size={48} strokeWidth={1} />
          <h3>No tables yet</h3>
          <p>Create a custom table or pick a template above.</p>
        </div>
      ) : (
        <TableBoard
          tables={fullTables}
          getTableApi={(tableId) => makeTableApi(tableId)}
          onDeleteTable={handleDelete}
          onTableChange={refreshTable}
          highlightId={highlightTableId}
          loading={loading}
          emptyMessage="No tables yet. Create one to get started."
        />
      )}

      {modalOpen && (
        <TableModal onClose={handleClose} onSaved={handleModalSaved} />
      )}
    </div>
  );
}
