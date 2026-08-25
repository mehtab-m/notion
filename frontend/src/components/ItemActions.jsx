import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Star, Archive } from 'lucide-react';
import { toggleFavorite, archiveItem } from '../utils/api';

/**
 * The star / archive pair every list item shares. Kept in one component
 * so a book card and a habit row behave identically — and so adding a
 * third lifecycle verb later is a single edit.
 *
 * `type` is the key from the backend's LIFECYCLE_MODELS map
 * (note · book · show · table · habit · goal · sticky).
 */
export default function ItemActions({
  type,
  id,
  favorite = false,
  onChange,
  onArchived,
  showArchive = true,
  size = 14,
  className = '',
  /* 'default' uses the global .icon-btn; 'card' borrows the existing
     .card-action-btn so it sits flush with a card's own controls. */
  variant = 'default',
}) {
  const buttonClass = variant === 'card' ? 'card-action-btn' : 'icon-btn icon-btn-sm';
  const [starred, setStarred] = useState(favorite);
  const [busy, setBusy] = useState(false);

  const star = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);

    const next = !starred;
    setStarred(next);
    try {
      await toggleFavorite(type, id, next);
      onChange?.(next);
    } catch (err) {
      // Roll the icon back so it never claims a state the server rejected.
      setStarred(!next);
      toast.error(err.response?.data?.error || 'Could not update that');
    } finally {
      setBusy(false);
    }
  };

  const archive = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await archiveItem(type, id);
      toast.success('Archived — find it under Archive');
      onArchived?.(id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not archive that');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`item-actions ${className}`}>
      <button
        type="button"
        className={`${buttonClass} ${starred ? 'is-starred' : ''}`}
        onClick={star}
        disabled={busy}
        aria-pressed={starred}
        aria-label={starred ? 'Remove star' : 'Star this'}
        title={starred ? 'Remove star' : 'Star this'}
      >
        <Star size={size} fill={starred ? 'currentColor' : 'none'} />
      </button>

      {showArchive && (
        <button
          type="button"
          className={buttonClass}
          onClick={archive}
          disabled={busy}
          aria-label="Archive"
          title="Archive without deleting"
        >
          <Archive size={size} />
        </button>
      )}
    </div>
  );
}
