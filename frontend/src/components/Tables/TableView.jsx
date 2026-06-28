import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getTable } from '../../utils/api';
import DynamicTable from './DynamicTable';
import './TableView.css';

export default function TableView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTable(id);
      setTable(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load table');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTable(); }, [fetchTable]);

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <h3>Error</h3>
        <p>{error}</p>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/tables')}>
          Back to Tables
        </button>
      </div>
    );
  }

  if (!table) return null;

  return (
    <div className="table-view">
      <div className="table-view-header">
        <button className="back-btn" onClick={() => navigate('/tables')}>
          <ArrowLeft size={16} /> All Tables
        </button>
      </div>
      <DynamicTable table={table} onTableChange={fetchTable} />
    </div>
  );
}
