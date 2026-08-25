/* ─── Theme entitlements ───────────────────────────────────
   The palettes themselves live in the frontend as CSS custom
   properties; the server only owns the question of who is
   allowed to pick which one. Gating in the client alone would
   mean a saved preference could name a locked theme.       */

/** Built-in themes, in the order Settings lists them. */
const THEME_CATALOG = [
  { id: 'light',    label: 'Daylight',  tier: 'free',     mode: 'light' },
  { id: 'dark',     label: 'Midnight',  tier: 'free',     mode: 'dark'  },
  { id: 'dim',      label: 'Dim',       tier: 'free',     mode: 'dark'  },
  { id: 'aurora',   label: 'Aurora',    tier: 'platinum', mode: 'dark'  },
  { id: 'sunset',   label: 'Sunset',    tier: 'platinum', mode: 'light' },
  { id: 'nord',     label: 'Nord',      tier: 'platinum', mode: 'dark'  },
  { id: 'rose',     label: 'Rosé',      tier: 'platinum', mode: 'light' },
  { id: 'forest',   label: 'Forest',    tier: 'platinum', mode: 'dark'  },
  { id: 'mono',     label: 'Monochrome',tier: 'platinum', mode: 'light' },
];

/** Plans allowed past the free tier. One constant, one place to change. */
const UNLOCK_PLANS = ['platinum'];

const FREE_THEME_IDS = THEME_CATALOG.filter((t) => t.tier === 'free').map((t) => t.id);
const ALL_THEME_IDS = THEME_CATALOG.map((t) => t.id);

/** Tokens a custom theme is allowed to override. */
const CUSTOM_TOKENS = [
  'bg-primary', 'bg-secondary', 'bg-card', 'bg-hover',
  'border', 'border-light',
  'text-primary', 'text-secondary', 'text-muted',
  'accent', 'accent-hover', 'accent-soft',
  'accent-green', 'accent-yellow', 'accent-red', 'accent-blue',
];

const MAX_CUSTOM_THEMES = 12;
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function canUnlock(user) {
  return UNLOCK_PLANS.includes(user?.plan);
}

/** Is this user entitled to this built-in theme? */
function isThemeAllowed(user, themeId) {
  const theme = THEME_CATALOG.find((t) => t.id === themeId);
  if (!theme) return false;
  return theme.tier === 'free' || canUnlock(user);
}

/**
 * Validate one custom theme. Returns the cleaned object; throws a
 * plain Error with `.status = 400` on anything malformed.
 */
function sanitizeCustomTheme(raw, index = 0) {
  const fail = (msg) => {
    const err = new Error(msg);
    err.status = 400;
    throw err;
  };

  if (!raw || typeof raw !== 'object') fail('Custom theme must be an object');

  const id = String(raw.id || `custom-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);
  if (!id) fail('Custom theme needs an id');

  const name = String(raw.name || 'Custom').trim().slice(0, 40) || 'Custom';
  const mode = raw.mode === 'dark' ? 'dark' : 'light';
  const base = ALL_THEME_IDS.includes(raw.base) ? raw.base : (mode === 'dark' ? 'dark' : 'light');

  const tokens = {};
  const source = raw.tokens && typeof raw.tokens === 'object' ? raw.tokens : {};
  for (const key of CUSTOM_TOKENS) {
    const value = source[key];
    if (value == null || value === '') continue;
    const str = String(value).trim();
    /* Only plain hex is accepted. Letting arbitrary strings through
       would put attacker-controlled text into a style attribute. */
    if (!HEX_RE.test(str)) fail(`"${key}" must be a hex colour like #4F46E5`);
    tokens[key] = str;
  }
  if (!Object.keys(tokens).length) fail('A custom theme needs at least one colour');

  return { id: `custom:${id}`.replace(/^custom:custom:/, 'custom:'), name, mode, base, tokens };
}

/**
 * Validate a whole themeSettings payload against the user's plan.
 * Returns the object to persist.
 */
function sanitizeThemeSettings(user, body, existing = {}) {
  const fail = (msg) => {
    const err = new Error(msg);
    err.status = 400;
    throw err;
  };

  const out = {
    themeId: existing.themeId || 'light',
    customThemes: Array.isArray(existing.customThemes) ? existing.customThemes : [],
    density: existing.density || 'comfortable',
    fontScale: existing.fontScale || 100,
    reducedMotion: existing.reducedMotion === true,
  };

  if (body.customThemes !== undefined) {
    if (!Array.isArray(body.customThemes)) fail('customThemes must be an array');
    if (body.customThemes.length && !canUnlock(user)) {
      fail('Custom themes are a Platinum feature');
    }
    if (body.customThemes.length > MAX_CUSTOM_THEMES) {
      fail(`You can save up to ${MAX_CUSTOM_THEMES} custom themes`);
    }
    out.customThemes = body.customThemes.map(sanitizeCustomTheme);
  }

  if (body.themeId !== undefined) {
    const themeId = String(body.themeId);
    if (themeId.startsWith('custom:')) {
      if (!canUnlock(user)) fail('Custom themes are a Platinum feature');
      if (!out.customThemes.some((t) => t.id === themeId)) fail('That custom theme does not exist');
      out.themeId = themeId;
    } else {
      if (!ALL_THEME_IDS.includes(themeId)) fail('Unknown theme');
      if (!isThemeAllowed(user, themeId)) {
        fail('That theme is available on the Platinum plan');
      }
      out.themeId = themeId;
    }
  }

  if (body.density !== undefined) {
    if (!['compact', 'comfortable', 'spacious'].includes(body.density)) fail('Invalid density');
    out.density = body.density;
  }

  if (body.fontScale !== undefined) {
    const scale = Math.round(Number(body.fontScale));
    if (!Number.isFinite(scale) || scale < 85 || scale > 125) {
      fail('Font scale must be between 85 and 125');
    }
    out.fontScale = scale;
  }

  if (body.reducedMotion !== undefined) {
    out.reducedMotion = body.reducedMotion === true || body.reducedMotion === 'true';
  }

  /* A downgrade should not strand the user on a theme they can no
     longer use — fall back rather than leaving a broken palette. */
  if (!canUnlock(user)) {
    if (out.themeId.startsWith('custom:') || !FREE_THEME_IDS.includes(out.themeId)) {
      out.themeId = 'light';
    }
    out.customThemes = [];
  }

  return out;
}

/** The settings object the client should receive, plan already applied. */
function resolveThemeSettings(user) {
  const stored = user?.themeSettings && typeof user.themeSettings === 'object'
    ? user.themeSettings
    : {};
  const unlocked = canUnlock(user);
  let themeId = typeof stored.themeId === 'string' ? stored.themeId : 'light';
  const customThemes = unlocked && Array.isArray(stored.customThemes) ? stored.customThemes : [];

  if (!unlocked && (themeId.startsWith('custom:') || !FREE_THEME_IDS.includes(themeId))) {
    themeId = 'light';
  }
  if (themeId.startsWith('custom:') && !customThemes.some((t) => t.id === themeId)) {
    themeId = 'dark';
  }

  return {
    themeId,
    customThemes,
    density: stored.density || 'comfortable',
    fontScale: stored.fontScale || 100,
    reducedMotion: stored.reducedMotion === true,
    unlocked,
    freeThemeIds: FREE_THEME_IDS,
    maxCustomThemes: MAX_CUSTOM_THEMES,
  };
}

module.exports = {
  THEME_CATALOG,
  FREE_THEME_IDS,
  ALL_THEME_IDS,
  CUSTOM_TOKENS,
  MAX_CUSTOM_THEMES,
  UNLOCK_PLANS,
  canUnlock,
  isThemeAllowed,
  sanitizeCustomTheme,
  sanitizeThemeSettings,
  resolveThemeSettings,
};
