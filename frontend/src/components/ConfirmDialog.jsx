import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './ConfirmDialog.css';

export default function ConfirmDialog({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="confirm-dialog-icon">
          <AlertTriangle size={22} />
        </div>
        <div className="confirm-dialog-body">
          <h3>{title}</h3>
          <p>{message}</p>
        </div>
        <button className="confirm-dialog-close" onClick={onCancel} aria-label="Close">
          <X size={16} />
        </button>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
