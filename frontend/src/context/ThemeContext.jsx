import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { updateTheme as saveThemeApi } from '../utils/api';
import {
  THEMES,
  FREE_THEME_IDS,
  DEFAULT_THEME_ID,
  MAX_CUSTOM_THEMES,
  CUSTOM_TOKEN_KEYS,
  canUseTheme,
  isCustomThemeId,
  planUnlocks,
  resolveMode,
} from '../theme/catalog';

const ThemeContext = createContext(null);

/* One localStorage key holds the whole appearance state. It is read by
   the inline script in index.html before React boots, which is what
   stops the flash of the wrong palette on every page load. */
const STORAGE_KEY = 'sortlife_appearance';
/* The old single-value key, kept only long enough to migrate. */
const LEGACY_KEY = 'sortlife_theme';

const DEFAULTS = {
  themeId: DEFAULT_THEME_ID,
  customThemes: [],
  density: 'comfortable',
  fontScale: 100,
  reducedMotion: false,
};

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* corrupt or unavailable — fall through to the legacy path */
  }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'light' || legacy === 'dark') return { ...DEFAULTS, themeId: legacy };
  } catch {
    /* ignore */
  }
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return { ...DEFAULTS, themeId: prefersDark ? 'dark' : DEFAULT_THEME_ID };
}

function persist(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Keep the legacy key in step for any tab still running old code.
    localStorage.setItem(LEGACY_KEY, state.themeId);
  } catch {
    /* private mode — the theme still works, it just will not survive */
  }
}

/**
 * Write the resolved appearance onto <html>. Built-in themes come from
 * a stylesheet block; a custom one is painted as inline variables,
 * which outrank every selector and so need no generated CSS.
 */
function applyToDocument(state) {
  const root = document.documentElement;
  const { themeId, customThemes, density, fontScale, reducedMotion } = state;
  const custom = isCustomThemeId(themeId)
    ? customThemes.find((t) => t.id === themeId)
    : null;

  // A custom theme layers over its base so untouched tokens still resolve.
  root.setAttribute('data-theme', custom ? custom.base || 'light' : themeId);
  root.setAttribute('data-mode', resolveMode(themeId, customThemes));
  root.setAttribute('data-density', density);
  root.setAttribute('data-reduced-motion', String(reducedMotion));
  root.style.setProperty('--font-scale', String((fontScale || 100) / 100));

  // Clear the previous custom palette before painting the next one.
  for (const key of CUSTOM_TOKEN_KEYS) root.style.removeProperty(`--${key}`);
  if (custom?.tokens) {
    for (const [key, value] of Object.entries(custom.tokens)) {
      if (CUSTOM_TOKEN_KEYS.includes(key)) root.style.setProperty(`--${key}`, value);
    }
  }

  /* Keep the browser chrome (address bar, form controls) in step with
     the palette, otherwise a dark theme sits under a white status bar. */
  const mode = resolveMode(themeId, customThemes);
  root.style.colorScheme = mode;
  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
    || (() => {
      const el = document.createElement('meta');
      el.setAttribute('name', 'theme-color');
      document.head.appendChild(el);
      return el;
    })();
  meta.setAttribute(
    'content',
    getComputedStyle(root).getPropertyValue('--bg-primary').trim() || '#ffffff'
  );
}

export function ThemeProvider({ children }) {
  const { user, updateUser, isAuthenticated } = useAuth() || {};
  const plan = user?.plan || 'common';
  const unlocked = planUnlocks(plan);

  const [state, setState] = useState(readStored);
  const [saving, setSaving] = useState(false);
  // Guards the "adopt the server's copy" effect from re-running per render.
  const hydratedFor = useRef(null);
  /* React may invoke a state updater more than once, so the rollback
     snapshot cannot be captured inside one. This ref always holds the
     last painted state, which is exactly what a failed save reverts to. */
  const stateRef = useRef(state);
  stateRef.current = state;

  /* Paint on every change. Runs before the browser repaints, so a theme
     switch never shows an intermediate frame. */
  useEffect(() => {
    applyToDocument(state);
    persist(state);
  }, [state]);

  /* Once the account loads, the server's saved appearance wins — that is
     what makes a theme follow the user to a second device. */
  useEffect(() => {
    if (!user?._id || hydratedFor.current === user._id) return;
    hydratedFor.current = user._id;
    const remote = user.themeSettings;
    if (!remote || typeof remote !== 'object') return;
    setState((prev) => ({
      ...prev,
      themeId: remote.themeId || prev.themeId,
      customThemes: Array.isArray(remote.customThemes) ? remote.customThemes : [],
      density: remote.density || prev.density,
      fontScale: remote.fontScale || prev.fontScale,
      reducedMotion: remote.reducedMotion === true,
    }));
  }, [user?._id, user?.themeSettings]);

  /* A downgrade (or an expired plan) must not strand the user on a
     palette they can no longer use. */
  useEffect(() => {
    if (unlocked || !isAuthenticated) return;
    setState((prev) => {
      const stranded =
        isCustomThemeId(prev.themeId) || !FREE_THEME_IDS.includes(prev.themeId);
      if (!stranded && !prev.customThemes.length) return prev;
      return { ...prev, themeId: stranded ? DEFAULT_THEME_ID : prev.themeId, customThemes: [] };
    });
  }, [unlocked, isAuthenticated]);

  /** Push part of the appearance to the server, rolling back on refusal. */
  const sync = useCallback(
    async (patch, previous) => {
      if (!isAuthenticated) return true;
      setSaving(true);
      try {
        const data = await saveThemeApi(patch);
        if (data?.user) updateUser?.(data.user);
        return true;
      } catch (err) {
        setState(previous);
        toast.error(err.response?.data?.error || 'Could not save your theme');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [isAuthenticated, updateUser]
  );

  /* A preview paints the document without touching state, storage or the
     server, and ignores entitlement — the marketing page shows every
     palette to everyone; only *keeping* one is gated. */
  const previewing = useRef(false);

  const preview = useCallback((id) => {
    if (!id) return;
    previewing.current = true;
    applyToDocument({ ...stateRef.current, themeId: id });
  }, []);

  const endPreview = useCallback(() => {
    if (!previewing.current) return;
    previewing.current = false;
    applyToDocument(stateRef.current);
  }, []);

  const setTheme = useCallback(
    (idOrObj) => {
      const id = typeof idOrObj === 'string' ? idOrObj : idOrObj?.id;
      if (!id) return false;
      if (!canUseTheme(plan, id)) {
        toast.error('That theme is part of the Platinum plan');
        return false;
      }
      const previous = stateRef.current;
      // A preview may have left the document on another palette.
      previewing.current = false;
      if (previous.themeId === id) {
        applyToDocument(previous);
        return true;
      }
      setState((prev) => ({ ...prev, themeId: id }));
      sync({ themeId: id }, previous);
      return true;
    },
    [plan, sync]
  );

  /** Flip between the light and dark member of the current family. */
  const toggleTheme = useCallback(() => {
    const previous = stateRef.current;
    const mode = resolveMode(previous.themeId, previous.customThemes);
    const target = mode === 'dark' ? 'light' : 'dark';
    // Prefer another unlocked theme in the opposite mode before falling back.
    const next =
      THEMES.find(
        (t) => t.mode === target && canUseTheme(plan, t.id) && t.id !== previous.themeId
      )?.id || (target === 'dark' ? 'dark' : 'light');
    if (next === previous.themeId) return;
    setState((prev) => ({ ...prev, themeId: next }));
    sync({ themeId: next }, previous);
  }, [plan, sync]);

  const setDensity = useCallback(
    (density) => {
      const previous = stateRef.current;
      if (previous.density === density) return;
      setState((prev) => ({ ...prev, density }));
      sync({ density }, previous);
    },
    [sync]
  );

  const setFontScale = useCallback(
    (fontScale) => {
      const clamped = Math.max(85, Math.min(125, Math.round(fontScale)));
      const previous = stateRef.current;
      if (previous.fontScale === clamped) return;
      setState((prev) => ({ ...prev, fontScale: clamped }));
      sync({ fontScale: clamped }, previous);
    },
    [sync]
  );

  const setReducedMotion = useCallback(
    (reducedMotion) => {
      const next = !!reducedMotion;
      const previous = stateRef.current;
      if (previous.reducedMotion === next) return;
      setState((prev) => ({ ...prev, reducedMotion: next }));
      sync({ reducedMotion: next }, previous);
    },
    [sync]
  );

  /** Create or update one custom palette. Returns the saved theme, or null. */
  const saveCustomTheme = useCallback(
    async (theme) => {
      if (!unlocked) {
        toast.error('Custom themes are a Platinum feature');
        return null;
      }
      const id = theme.id?.startsWith('custom:')
        ? theme.id
        : `custom:${(theme.name || 'custom')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 32) || 'theme'}-${Date.now().toString(36)}`;

      const cleaned = {
        id,
        name: (theme.name || 'Custom').trim().slice(0, 40) || 'Custom',
        mode: theme.mode === 'dark' ? 'dark' : 'light',
        base: theme.base || (theme.mode === 'dark' ? 'dark' : 'light'),
        tokens: Object.fromEntries(
          Object.entries(theme.tokens || {}).filter(
            ([k, v]) => CUSTOM_TOKEN_KEYS.includes(k) && /^#[0-9a-fA-F]{3,8}$/.test(String(v))
          )
        ),
      };

      if (!Object.keys(cleaned.tokens).length) {
        toast.error('Pick at least one colour first');
        return null;
      }

      const previous = stateRef.current;
      const exists = previous.customThemes.some((t) => t.id === id);
      if (!exists && previous.customThemes.length >= MAX_CUSTOM_THEMES) {
        toast.error(`You can keep up to ${MAX_CUSTOM_THEMES} custom themes`);
        return null;
      }

      const customThemes = exists
        ? previous.customThemes.map((t) => (t.id === id ? cleaned : t))
        : [...previous.customThemes, cleaned];

      setState((prev) => ({ ...prev, customThemes, themeId: id }));
      const ok = await sync({ customThemes, themeId: id }, previous);
      if (ok) toast.success(exists ? 'Theme updated' : 'Theme saved');
      return ok ? cleaned : null;
    },
    [sync, unlocked]
  );

  const deleteCustomTheme = useCallback(
    async (id) => {
      const previous = stateRef.current;
      const customThemes = previous.customThemes.filter((t) => t.id !== id);
      const themeId = previous.themeId === id ? DEFAULT_THEME_ID : previous.themeId;
      setState((prev) => ({ ...prev, customThemes, themeId }));
      const ok = await sync({ customThemes, themeId }, previous);
      if (ok) toast.success('Theme deleted');
      return ok;
    },
    [sync]
  );

  const value = useMemo(() => {
    const mode = resolveMode(state.themeId, state.customThemes);
    const activeCustom = isCustomThemeId(state.themeId)
      ? state.customThemes.find((t) => t.id === state.themeId) || null
      : null;
    return {
      ...state,
      mode,
      isDark: mode === 'dark',
      theme: activeCustom || THEMES.find((t) => t.id === state.themeId) || THEMES[0],
      activeCustom,
      themes: THEMES,
      plan,
      unlocked,
      saving,
      maxCustomThemes: MAX_CUSTOM_THEMES,
      canUse: (id) => canUseTheme(plan, id),
      preview,
      endPreview,
      setTheme,
      toggleTheme,
      setDensity,
      setFontScale,
      setReducedMotion,
      saveCustomTheme,
      deleteCustomTheme,
    };
  }, [
    state, plan, unlocked, saving, setTheme, toggleTheme, preview, endPreview,
    setDensity, setFontScale, setReducedMotion, saveCustomTheme, deleteCustomTheme,
  ]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { THEMES };
