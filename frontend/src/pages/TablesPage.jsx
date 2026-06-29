import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Table, Trash2, Columns, Zap } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import useApi from '../hooks/useApi';
import { getTables, deleteTable, createTable } from '../utils/api';
import TableModal from '../components/Tables/TableModal';
import TableView from '../components/Tables/TableView';
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

export default function TablesPage() {
  const { id } = useParams();

  if (id) {
    return <TableView />;
  }

  return <TableList />;
}

function TableList() {
  const navigate = useNavigate();
  const { data: tables, loading, refetch } = useApi(getTables);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const handleDelete = async (tableId) => {
    try {
      await deleteTable(tableId);
      toast.success('Table deleted');
      refetch();
    } catch {
      toast.error('Failed to delete table');
    }
    setConfirmId(null);
  };

  const handleTemplate = async (tpl) => {
    setCreatingTemplate(true);
    try {
      const cols = tpl.columns.map((c) => ({ id: crypto.randomUUID(), ...c, options: c.options || [] }));
      const created = await createTable({ name: tpl.name, columns: cols });
      toast.success(`"${tpl.name}" table created!`);
      refetch();
      navigate(`/tables/${created._id}`);
    } catch {
      toast.error('Failed to create template');
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleClose = useCallback(() => setModalOpen(false), []);

  return (
    <div>
      <div className="page-header">
        <h1>Tables</h1>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New Table
        </button>
      </div>

      {/* Templates */}
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

      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : !tables || tables.length === 0 ? (
        <div className="empty-state">
          <Table size={48} strokeWidth={1} />
          <h3>No tables yet</h3>
          <p>Create a custom table to track anything.</p>
        </div>
      ) : (
        <div className="tables-grid">
          {tables.map((table) => (
            <div
              key={table._id}
              className="table-card"
              onClick={() => navigate(`/tables/${table._id}`)}
            >
              <div className="table-card-icon">
                <Table size={22} color="var(--accent-blue)" />
              </div>
              <div className="table-card-info">
                <h3 className="table-card-name">{table.name}</h3>
                <div className="table-card-meta">
                  <span className="table-card-meta-item">
                    <Columns size={12} />
                    {table.columnCount} columns
                  </span>
                  <span className="table-card-meta-item">{table.rowCount} rows</span>
                  <span className="table-card-meta-item">
                    {format(new Date(table.createdAt), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              <div className="table-card-actions" onClick={(e) => e.stopPropagation()}>
                {confirmId === table._id ? (
                  <div className="confirm-delete">
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(table._id)}>
                      Delete
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setConfirmId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="card-action-btn danger"
                    onClick={() => setConfirmId(table._id)}
                    title="Delete table"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && <TableModal onClose={handleClose} onSaved={refetch} />}
    </div>
  );
}
