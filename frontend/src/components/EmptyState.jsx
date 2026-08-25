import React from 'react';
import { Link } from 'react-router-dom';

/**
 * The shared "nothing here yet" panel. Every empty list should say what
 * the thing is for and offer the one action that fills it — a bare
 * "No items" tells the user nothing they did not already know.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionTo,
  secondaryLabel,
  onSecondary,
  children,
}) {
  return (
    <div className="empty-state">
      {Icon && (
        <span className="empty-state-art" aria-hidden>
          <Icon size={30} />
        </span>
      )}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}

      {(actionLabel || secondaryLabel) && (
        <div className="row" style={{ gap: 'var(--sp-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {actionLabel && actionTo && (
            <Link to={actionTo} className="btn btn-primary">{actionLabel}</Link>
          )}
          {actionLabel && !actionTo && onAction && (
            <button type="button" className="btn btn-primary" onClick={onAction}>
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button type="button" className="btn btn-secondary" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
