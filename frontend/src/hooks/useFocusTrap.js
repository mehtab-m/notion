import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keeps Tab focus inside an open dialog and restores it to whatever was
 * focused beforehand on close. Without this, tabbing out of a modal
 * lands on the page behind it — the content a screen reader has just
 * been told is inert.
 *
 * Returns a ref to attach to the dialog element.
 */
export default function useFocusTrap(active, { onEscape, autoFocus = true } = {}) {
  const containerRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    previouslyFocused.current = document.activeElement;
    const node = containerRef.current;

    if (autoFocus && node) {
      const first = node.querySelector(FOCUSABLE);
      // Fall back to the container so focus never stays outside.
      (first || node).focus?.();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab' || !node) return;

      const items = Array.from(node.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    // Stop the page behind the dialog from scrolling under it.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [active, onEscape, autoFocus]);

  return containerRef;
}
