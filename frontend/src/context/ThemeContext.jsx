import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext();
const STORAGE_KEY = 'sortlife-theme';
const CUSTOM_KEY = 'sortlife-theme-custom';

export const THEME_VARS = [
  { key: '--bg-primary', label: 'Background' },
  { key: '--bg-secondary', label: 'Surface' },
  { key: '--bg-hover', label: 'Hover' },
  { key: '--text-primary', label: 'Text' },
  { key: '--text-secondary', label: 'Muted text' },
  { key: '--text-muted', label: 'Faint text' },
  { key: '--border', label: 'Border' },
  { key: '--accent', label: 'Accent' },
  { key: '--accent-green', label: 'Success' },
  { key: '--accent-red', label: 'Danger' },
  { key: '--accent-yellow', label: 'Warning' },
  { key: '--accent-blue', label: 'Info' },
];

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
  {
    id: 'custom',
    label: 'Custom',
    swatch: ['#121212', '#f5f5f5', '#0d9488'],
    desc: 'Your editable palette',
  },
];

const DEFAULT_CUSTOM = {
  '--bg-primary': '#0f1216',
  '--bg-secondary': '#171b22',
  '--bg-hover': '#1f2530',
  '--text-primary': '#e8eaed',
  '--text-secondary': '#a8b0bc',
  '--text-muted': '#6b7280',
  '--border': '#2a3140',
  '--accent': '#0d9488',
  '--accent-green': '#22c55e',
  '--accent-red': '#ef4444',
  '--accent-yellow': '#f59e0b',
  '--accent-blue': '#3b82f6',
};

function loadCustom() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return { ...DEFAULT_CUSTOM };
    return { ...DEFAULT_CUSTOM, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CUSTOM };
  }
}

function applyCustomVars(vars) {
  const root = document.documentElement;
  THEME_VARS.forEach(({ key }) => {
    if (vars[key]) root.style.setProperty(key, vars[key]);
  });
}

function clearCustomVars() {
  const root = document.documentElement;
  THEME_VARS.forEach(({ key }) => root.style.removeProperty(key));
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (THEMES.some((t) => t.id === saved)) return saved;
    } catch { /* ignore */ }
    return 'light';
  });
  const [customVars, setCustomVars] = useState(loadCustom);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'custom' ? 'dark' : theme);
    localStorage.setItem(STORAGE_KEY, theme);
    if (theme === 'custom') applyCustomVars(customVars);
    else clearCustomVars();
  }, [theme, customVars]);

  const setTheme = useCallback((id) => {
    if (THEMES.some((t) => t.id === id)) setThemeState(id);
  }, []);

  const updateCustomVar = useCallback((key, value) => {
    setCustomVars((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetCustom = useCallback(() => {
    setCustomVars({ ...DEFAULT_CUSTOM });
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(DEFAULT_CUSTOM));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        themes: THEMES,
        customVars,
        updateCustomVar,
        resetCustom,
        themeVars: THEME_VARS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
