import React, { createContext, useContext, useState, useCallback } from 'react';

const StickyNotesOverlayContext = createContext(null);

export function StickyNotesOverlayProvider({ children }) {
  const [hiddenIds, setHiddenIds] = useState(() => new Set());

  const hideFromOverlay = useCallback((id) => {
    setHiddenIds((prev) => new Set([...prev, id]));
  }, []);

  const hideAllFromOverlay = useCallback((ids = []) => {
    setHiddenIds((prev) => new Set([...prev, ...ids]));
  }, []);

  const showOnOverlay = useCallback((id) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const showAllOnOverlay = useCallback(() => {
    setHiddenIds(new Set());
  }, []);

  const isHiddenFromOverlay = useCallback((id) => hiddenIds.has(id), [hiddenIds]);

  return (
    <StickyNotesOverlayContext.Provider
      value={{
        hiddenIds,
        hideFromOverlay,
        hideAllFromOverlay,
        showOnOverlay,
        showAllOnOverlay,
        isHiddenFromOverlay,
      }}
    >
      {children}
    </StickyNotesOverlayContext.Provider>
  );
}

export function useStickyNotesOverlay() {
  const ctx = useContext(StickyNotesOverlayContext);
  if (!ctx) throw new Error('useStickyNotesOverlay must be used within StickyNotesOverlayProvider');
  return ctx;
}
