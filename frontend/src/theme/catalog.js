/* ─── Theme catalogue ──────────────────────────────────────
   Mirrors backend/utils/themes.js. The palettes themselves are
   CSS (styles/themes.css); what lives here is the metadata the
   Settings gallery needs — labels, tier, and the three swatch
   colours each preview tile paints itself with.

   Tiers: 'free' (everyone) · 'platinum' (Platinum plan only).
   ───────────────────────────────────────────────────────── */

export const THEMES = [
  {
    id: 'light',
    label: 'Daylight',
    tier: 'free',
    mode: 'light',
    description: 'Clean off-white with an indigo accent.',
    swatch: ['#F6F7F9', '#FFFFFF', '#4F46E5'],
  },
  {
    id: 'dark',
    label: 'Midnight',
    tier: 'free',
    mode: 'dark',
    description: 'Near-black, high contrast, low glare.',
    swatch: ['#08090D', '#14161D', '#6366F1'],
  },
  {
    id: 'dim',
    label: 'Dim',
    tier: 'free',
    mode: 'dark',
    description: 'Softer than Midnight — easy for long sessions.',
    swatch: ['#16181D', '#21252D', '#7C8CF8'],
  },
  {
    id: 'aurora',
    label: 'Aurora',
    tier: 'platinum',
    mode: 'dark',
    description: 'Deep ocean navy lit by teal.',
    swatch: ['#04121A', '#0A2130', '#2DD4BF'],
  },
  {
    id: 'sunset',
    label: 'Sunset',
    tier: 'platinum',
    mode: 'light',
    description: 'Warm cream and amber, golden hour all day.',
    swatch: ['#FFF8F2', '#FFFDFB', '#EA580C'],
  },
  {
    id: 'nord',
    label: 'Nord',
    tier: 'platinum',
    mode: 'dark',
    description: 'Arctic blue-grey, quiet and even.',
    swatch: ['#2E3440', '#3B4252', '#88C0D0'],
  },
  {
    id: 'rose',
    label: 'Rosé',
    tier: 'platinum',
    mode: 'light',
    description: 'Soft blush with a magenta edge.',
    swatch: ['#FDF6F8', '#FFFDFE', '#DB2777'],
  },
  {
    id: 'forest',
    label: 'Forest',
    tier: 'platinum',
    mode: 'dark',
    description: 'Pine dark with a living green accent.',
    swatch: ['#0A1410', '#12261E', '#4ADE80'],
  },
  {
    id: 'mono',
    label: 'Monochrome',
    tier: 'platinum',
    mode: 'light',
    description: 'Pure black on white. Maximum contrast.',
    swatch: ['#FFFFFF', '#F0F0F0', '#111111'],
  },
];

/** Plans that unlock the platinum tier and the custom builder. */
export const UNLOCK_PLANS = ['platinum'];

export const FREE_THEMES = THEMES.filter((t) => t.tier === 'free');
export const PLATINUM_THEMES = THEMES.filter((t) => t.tier === 'platinum');
export const FREE_THEME_IDS = FREE_THEMES.map((t) => t.id);
export const DEFAULT_THEME_ID = 'light';
export const MAX_CUSTOM_THEMES = 12;

/** The tokens the custom theme builder exposes, in editing order. */
export const CUSTOM_TOKEN_FIELDS = [
  { key: 'bg-primary', label: 'Page background', group: 'Surfaces' },
  { key: 'bg-secondary', label: 'Panel', group: 'Surfaces' },
  { key: 'bg-card', label: 'Card', group: 'Surfaces' },
  { key: 'bg-hover', label: 'Hover', group: 'Surfaces' },
  { key: 'border', label: 'Border', group: 'Surfaces' },
  { key: 'border-light', label: 'Border (strong)', group: 'Surfaces' },
  { key: 'text-primary', label: 'Text', group: 'Text' },
  { key: 'text-secondary', label: 'Text (secondary)', group: 'Text' },
  { key: 'text-muted', label: 'Text (muted)', group: 'Text' },
  { key: 'accent', label: 'Accent', group: 'Accent' },
  { key: 'accent-hover', label: 'Accent (hover)', group: 'Accent' },
  { key: 'accent-soft', label: 'Accent (soft)', group: 'Accent' },
  { key: 'accent-green', label: 'Success', group: 'Status' },
  { key: 'accent-yellow', label: 'Warning', group: 'Status' },
  { key: 'accent-red', label: 'Danger', group: 'Status' },
  { key: 'accent-blue', label: 'Info', group: 'Status' },
];

export const CUSTOM_TOKEN_KEYS = CUSTOM_TOKEN_FIELDS.map((f) => f.key);

/** Sensible starting points so a new custom theme is never blank. */
export const CUSTOM_PRESETS = {
  light: {
    'bg-primary': '#F6F7F9',
    'bg-secondary': '#FFFFFF',
    'bg-card': '#FFFFFF',
    'bg-hover': '#EFF1F5',
    border: '#E4E7EC',
    'border-light': '#D0D5DD',
    'text-primary': '#101828',
    'text-secondary': '#475467',
    'text-muted': '#98A2B3',
    accent: '#4F46E5',
    'accent-hover': '#4338CA',
    'accent-soft': '#EEF0FF',
    'accent-green': '#059669',
    'accent-yellow': '#B45309',
    'accent-red': '#DC2626',
    'accent-blue': '#2563EB',
  },
  dark: {
    'bg-primary': '#0B0D12',
    'bg-secondary': '#12141B',
    'bg-card': '#171A22',
    'bg-hover': '#1F232C',
    border: '#23262F',
    'border-light': '#31353F',
    'text-primary': '#ECEDF1',
    'text-secondary': '#9BA1AE',
    'text-muted': '#666D7B',
    accent: '#6366F1',
    'accent-hover': '#818CF8',
    'accent-soft': '#1E2140',
    'accent-green': '#34D399',
    'accent-yellow': '#FBBF24',
    'accent-red': '#F87171',
    'accent-blue': '#60A5FA',
  },
};

export const DENSITIES = [
  { id: 'compact', label: 'Compact', description: 'More on screen, tighter spacing.' },
  { id: 'comfortable', label: 'Comfortable', description: 'The default balance.' },
  { id: 'spacious', label: 'Spacious', description: 'Room to breathe.' },
];

export function isCustomThemeId(id) {
  return typeof id === 'string' && id.startsWith('custom:');
}

export function findTheme(id) {
  return THEMES.find((t) => t.id === id) || null;
}

/** Is this plan entitled to the platinum tier? */
export function planUnlocks(plan) {
  return UNLOCK_PLANS.includes(plan);
}

/** Can this plan select this theme id? Custom ids need the unlock too. */
export function canUseTheme(plan, themeId) {
  if (isCustomThemeId(themeId)) return planUnlocks(plan);
  const theme = findTheme(themeId);
  if (!theme) return false;
  return theme.tier === 'free' || planUnlocks(plan);
}

/** Light or dark, for a built-in or a custom theme. */
export function resolveMode(themeId, customThemes = []) {
  if (isCustomThemeId(themeId)) {
    return customThemes.find((t) => t.id === themeId)?.mode === 'dark' ? 'dark' : 'light';
  }
  return findTheme(themeId)?.mode || 'light';
}
