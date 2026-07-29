import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext();

const STORAGE_KEY = 'sortlife_theme'; // single shared key across landing, auth, app

/* ─────────────────────────────────────────────────────────────
   Two themes — light (default) and dark. Single source of truth
   for the whole app. All token values live in index.css under
   :root / [data-theme='dark']; landing.css aliases nova-* tokens
   from the same core variables so marketing/auth pages match.
───────────────────────────────────────────────────────────── */
export const THEMES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

function resolveInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
    try { localStorage.setItem(STORAGE_KEY, themeId); } catch { /* ignore */ }
  }, [themeId]);

  const setTheme = useCallback((idOrObj) => {
    const id = typeof idOrObj === 'string' ? idOrObj : idOrObj?.id;
    if (id === 'light' || id === 'dark') setThemeId(id);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeId((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{
      themeId,
      theme: THEMES.find((t) => t.id === themeId) || THEMES[0],
      isDark: themeId === 'dark',
      setTheme,
      toggleTheme,
      themes: THEMES,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
