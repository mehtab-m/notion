import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import useFocusTrap from '../hooks/useFocusTrap';
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
  /* Also handles Escape and restores focus to the trigger on close —
     previously focus stayed on the page behind the dialog, which the
     aria-modal attribute had already told assistive tech to ignore. */
  const dialogRef = useFocusTrap(open, { onEscape: onCancel });

  if (!open) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div
        className="confirm-dialog"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="confirm-dialog-icon">
          <AlertTriangle size={22} />
        </div>
        <div className="confirm-dialog-body">
          <h3 id="confirm-dialog-title">{title}</h3>
          <p id="confirm-dialog-message">{message}</p>
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
