import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Table, Trash2, Columns } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import useApi from '../hooks/useApi';
import { getTables, deleteTable } from '../utils/api';
import TableModal from '../components/Tables/TableModal';
import TableView from '../components/Tables/TableView';
import './TablesPage.css';

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

  const handleClose = useCallback(() => setModalOpen(false), []);

  return (
    <div>
      <div className="page-header">
        <h1>Tables</h1>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New Table
        </button>
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
