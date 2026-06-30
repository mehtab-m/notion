import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Trash2, Columns, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import DynamicTable from './DynamicTable';
import './TableBoard.css';

function CollapsibleTableSection({
  table,
  tableApi,
  isOpen,
  onToggle,
  onDelete,
  onTableChange,
  sectionRef,
}) {
  const colCount = (table.columns || []).length;
  const rowCount = (table.rows || []).length;
  const tableId = table._id || table.id;

  return (
    <section
      ref={sectionRef}
      className={`table-board-section ${isOpen ? 'is-open' : 'is-collapsed'}`}
      data-table-id={tableId}
    >
      <header className="table-board-section-header">
        <button
          type="button"
          className="table-board-toggle"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Collapse table' : 'Expand table'}
        >
          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        <button type="button" className="table-board-title-btn" onClick={onToggle}>
          <h3 className="table-board-title">{table.name}</h3>
          <div className="table-board-meta">
            <span>
              <Columns size={12} />
              {colCount} {colCount === 1 ? 'column' : 'columns'}
            </span>
            <span>{rowCount} {rowCount === 1 ? 'row' : 'rows'}</span>
          </div>
        </button>
        {onDelete && (
          <button
            type="button"
            className="table-board-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(tableId);
            }}
            title="Delete table"
          >
            <Trash2 size={15} />
          </button>
        )}
      </header>
      {isOpen && (
        <div className="table-board-section-body">
          <DynamicTable
            table={table}
            tableApi={tableApi}
            hideName
            onTableChange={onTableChange}
          />
        </div>
      )}
    </section>
  );
}

export default function TableBoard({
  tables = [],
  getTableApi,
  onDeleteTable,
  onTableChange,
  highlightId,
  loading,
  emptyMessage = 'No tables yet.',
}) {
  const [openIds, setOpenIds] = useState(() => new Set());
  const sectionRefs = useRef({});
  const prevIdsRef = useRef(new Set());

  useEffect(() => {
    const prevIds = prevIdsRef.current;
    const currentIds = tables.map((t) => t._id || t.id);

    setOpenIds((prev) => {
      const next = new Set(prev);

      currentIds.forEach((id) => {
        if (!prevIds.has(id)) next.add(id);
      });

      for (const id of [...next]) {
        if (!currentIds.includes(id)) next.delete(id);
      }

      if (next.size === 0 && currentIds.length > 0) {
        currentIds.forEach((id) => next.add(id));
      }

      return next;
    });

    prevIdsRef.current = new Set(currentIds);
  }, [tables]);

  useEffect(() => {
    if (!highlightId || !tables.length) return;
    setOpenIds((prev) => new Set([...prev, highlightId]));
    const timer = setTimeout(() => {
      sectionRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => clearTimeout(timer);
  }, [highlightId, tables.length]);

  const toggle = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setOpenIds(new Set(tables.map((t) => t._id || t.id)));
  };

  const collapseAll = () => {
    setOpenIds(new Set());
  };

  if (loading) {
    return (
      <div className="spinner-container table-board-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!tables.length) {
    return (
      <div className="table-board-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const allOpen = tables.every((t) => openIds.has(t._id || t.id));
  const allClosed = tables.every((t) => !openIds.has(t._id || t.id));

  return (
    <div className="table-board">
      <div className="table-board-toolbar">
        <span className="table-board-count">
          {tables.length} {tables.length === 1 ? 'table' : 'tables'}
        </span>
        <div className="table-board-toolbar-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={expandAll}
            disabled={allOpen}
          >
            <ChevronsUpDown size={14} /> Expand all
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={collapseAll}
            disabled={allClosed}
          >
            <ChevronsDownUp size={14} /> Collapse all
          </button>
        </div>
      </div>

      <div className="table-board-stack">
        {tables.map((table) => {
          const id = table._id || table.id;
          return (
            <CollapsibleTableSection
              key={id}
              table={table}
              tableApi={getTableApi?.(id) || getTableApi?.(table)}
              isOpen={openIds.has(id)}
              onToggle={() => toggle(id)}
              onDelete={onDeleteTable}
              onTableChange={() => onTableChange?.(id)}
              sectionRef={(el) => {
                if (el) sectionRefs.current[id] = el;
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
