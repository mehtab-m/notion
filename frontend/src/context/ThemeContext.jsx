import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext();

const STORAGE_KEY = 'sortlife_theme'; // single shared key across landing, auth, app

/* ─────────────────────────────────────────────────────────────
   5 SortLife themes — single source of truth for the whole app
───────────────────────────────────────────────────────────── */
export const NOVA_THEMES = [
  {
    id: 'enterprise-blue',
    label: 'Enterprise Blue',
    desc: 'Professional deep navy with electric blue',
    swatch: ['#0D1117', '#E8F4FD', '#2563EB'],
    bg: '#0D1117', bg2: '#161B22', card: '#1C2333', bgHover: '#21262D',
    border: 'rgba(37,99,235,0.15)', borderMd: 'rgba(37,99,235,0.3)',
    text: '#E8F4FD', muted: '#8B9EC0', dim: '#4A5568',
    a1: '#2563EB', a2: '#3B82F6',
  },
  {
    id: 'midnight-dark',
    label: 'Midnight Dark',
    desc: 'Pure obsidian with cool silver accents',
    swatch: ['#0A0A0F', '#E8E8F0', '#6366F1'],
    bg: '#0A0A0F', bg2: '#111118', card: '#18181F', bgHover: '#222230',
    border: 'rgba(99,102,241,0.12)', borderMd: 'rgba(99,102,241,0.25)',
    text: '#E8E8F0', muted: '#9090A8', dim: '#5A5A70',
    a1: '#6366F1', a2: '#818CF8',
  },
  {
    id: 'emerald-green',
    label: 'Emerald Green',
    desc: 'Rich forest dark with emerald clarity',
    swatch: ['#061510', '#E4F5EE', '#10B981'],
    bg: '#061510', bg2: '#0B1E17', card: '#112820', bgHover: '#17352A',
    border: 'rgba(16,185,129,0.14)', borderMd: 'rgba(16,185,129,0.28)',
    text: '#E4F5EE', muted: '#6EAA8E', dim: '#3D6B56',
    a1: '#10B981', a2: '#34D399',
  },
  {
    id: 'violet-pro',
    label: 'Violet Pro',
    desc: 'Deep plum studio with vibrant violet',
    swatch: ['#0E0818', '#EDE8FA', '#7C3AED'],
    bg: '#0E0818', bg2: '#160E24', card: '#1E1330', bgHover: '#281A40',
    border: 'rgba(124,58,237,0.15)', borderMd: 'rgba(124,58,237,0.28)',
    text: '#EDE8FA', muted: '#9878D0', dim: '#614898',
    a1: '#7C3AED', a2: '#A78BFA',
  },
  {
    id: 'slate-dark',
    label: 'Slate Dark',
    desc: 'Refined charcoal with warm amber glow',
    swatch: ['#1A1512', '#F5EFE6', '#F5A623'],
    bg: '#1A1512', bg2: '#201C18', card: '#252018', bgHover: '#2E2720',
    border: 'rgba(245,166,35,0.12)', borderMd: 'rgba(245,166,35,0.22)',
    text: '#F5EFE6', muted: '#9A8E7E', dim: '#6B5F50',
    a1: '#F5A623', a2: '#FF8A3D',
  },
];

/* Kept for any legacy imports */
export const THEMES = NOVA_THEMES;

export const THEME_VARS = [
  { key: '--bg-primary',     label: 'Background' },
  { key: '--bg-secondary',   label: 'Surface' },
  { key: '--bg-hover',       label: 'Hover' },
  { key: '--text-primary',   label: 'Text' },
  { key: '--text-secondary', label: 'Muted text' },
  { key: '--text-muted',     label: 'Faint text' },
  { key: '--border',         label: 'Border' },
  { key: '--accent',         label: 'Accent' },
  { key: '--accent-green',   label: 'Success' },
  { key: '--accent-red',     label: 'Danger' },
  { key: '--accent-yellow',  label: 'Warning' },
  { key: '--accent-blue',    label: 'Info' },
];

/** Apply a theme to :root — ONLY sets the data-theme attribute.
 *  All actual token values live in index.css [data-theme='...'] blocks.
 *  Also sets nova-* tokens for landing + auth pages. */
export function applyNovaTheme(t) {
  const r = document.documentElement;

  /* Switch the CSS theme block */
  r.setAttribute('data-theme', t.id);

  /* Nova design-system tokens (landing + auth only, not overridden by index.css) */
  r.style.setProperty('--nova-bg',        t.bg);
  r.style.setProperty('--nova-bg-2',      t.bg2);
  r.style.setProperty('--nova-bg-card',   t.card);
  r.style.setProperty('--nova-bg-hover',  t.bgHover);
  r.style.setProperty('--nova-border',    t.border);
  r.style.setProperty('--nova-border-md', t.borderMd);
  r.style.setProperty('--nova-text',      t.text);
  r.style.setProperty('--nova-muted',     t.muted);
  r.style.setProperty('--nova-dim',       t.dim);
  r.style.setProperty('--nova-amber',     t.a1);
  r.style.setProperty('--nova-orange',    t.a2);
  r.style.setProperty('--nova-grad',      `linear-gradient(135deg,${t.a1},${t.a2})`);
  r.style.setProperty('--nova-glow',      `${t.a1}2e`);

  /* Remove ALL previously-inlined legacy tokens so CSS [data-theme] rules win */
  [
    '--bg-primary','--bg-secondary','--bg-card','--bg-hover',
    '--border','--border-light',
    '--text-primary','--text-secondary','--text-muted',
    '--accent','--accent-hover',
    '--accent-green','--accent-yellow','--accent-red','--accent-blue',
    '--shadow',
  ].forEach((v) => r.style.removeProperty(v));
}

function resolveInitialTheme() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return NOVA_THEMES.find((t) => t.id === id) || NOVA_THEMES[0];
  } catch {
    return NOVA_THEMES[0];
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(resolveInitialTheme);

  useEffect(() => {
    applyNovaTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, theme.id); } catch {}
  }, [theme]);

  const setTheme = useCallback((idOrObj) => {
    const t = typeof idOrObj === 'string'
      ? NOVA_THEMES.find((x) => x.id === idOrObj)
      : idOrObj;
    if (t) setThemeState(t);
  }, []);

  /* Stub legacy props so SettingsPage destructure doesn't crash */
  const updateCustomVar = useCallback(() => {}, []);
  const resetCustom     = useCallback(() => {}, []);

  return (
    <ThemeContext.Provider value={{
      theme,
      themeId:       theme.id,
      setTheme,
      themes:        NOVA_THEMES,
      customVars:    {},
      updateCustomVar,
      resetCustom,
      themeVars:     THEME_VARS,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
