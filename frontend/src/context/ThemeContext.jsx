import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext();
const STORAGE_KEY = 'sortlife-theme';

export const THEMES = [
  {
    id: 'light',
    label: 'Paper',
    swatch: ['#f4f2ee', '#1a1a1a', '#0d9488'],
    desc: 'Clean daylight workspace',
  },
  {
    id: 'dark',
    label: 'Midnight',
    swatch: ['#0b0d10', '#e8eaed', '#5eead4'],
    desc: 'Deep focus night mode',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    swatch: ['#071a22', '#e6f4f8', '#22d3ee'],
    desc: 'Teal depths & clear signal',
  },
  {
    id: 'forest',
    label: 'Canopy',
    swatch: ['#0f1712', '#e8f0e9', '#84cc16'],
    desc: 'Mossy calm productivity',
  },
  {
    id: 'ember',
    label: 'Ember',
    swatch: ['#140e0c', '#f3ebe4', '#f59e0b'],
    desc: 'Warm ink & amber accent',
  },
];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (THEMES.some((t) => t.id === saved)) return saved;
    } catch { /* ignore */ }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((id) => {
    if (THEMES.some((t) => t.id === id)) setThemeState(id);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
