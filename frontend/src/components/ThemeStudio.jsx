import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Palette, Plus, Trash2, Crown, Check, Lock, Sun, Moon, Wand2, RotateCcw, Save, X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  THEMES, CUSTOM_TOKEN_FIELDS, CUSTOM_PRESETS, DENSITIES,
} from '../theme/catalog';
import './ThemeStudio.css';

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Group the token fields so the editor reads as four short sections. */
function groupFields() {
  const groups = new Map();
  for (const field of CUSTOM_TOKEN_FIELDS) {
    if (!groups.has(field.group)) groups.set(field.group, []);
    groups.get(field.group).push(field);
  }
  return [...groups.entries()];
}

const GROUPS = groupFields();

/**
 * Derive a whole palette from one accent, so nobody has to fill in
 * sixteen colours by hand to try an idea.
 */
function paletteFromAccent(accent, mode) {
  const base = { ...CUSTOM_PRESETS[mode] };
  const hex = accent.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (rr, gg, bb) =>
    `#${[rr, gg, bb].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`;

  // Hover shifts toward white in dark mode and toward black in light.
  const shift = mode === 'dark' ? 34 : -34;
  base.accent = toHex(r, g, b);
  base['accent-hover'] = toHex(r + shift, g + shift, b + shift);
  base['accent-soft'] =
    mode === 'dark'
      ? toHex(r * 0.22 + 18, g * 0.22 + 20, b * 0.22 + 26)
      : toHex(255 - (255 - r) * 0.12, 255 - (255 - g) * 0.12, 255 - (255 - b) * 0.12);
  return base;
}

function emptyDraft(mode = 'light') {
  return {
    id: null,
    name: '',
    mode,
    base: mode,
    tokens: { ...CUSTOM_PRESETS[mode] },
  };
}

export default function ThemeStudio() {
  const {
    themeId, themes, customThemes, unlocked, canUse, setTheme,
    saveCustomTheme, deleteCustomTheme, maxCustomThemes,
    density, setDensity, fontScale, setFontScale,
    reducedMotion, setReducedMotion, saving,
  } = useTheme();

  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(() => emptyDraft());

  useEffect(() => {
    if (editing === 'new') setDraft(emptyDraft(draft.mode));
    else if (editing) {
      const found = customThemes.find((t) => t.id === editing);
      if (found) {
        setDraft({
          ...found,
          tokens: { ...CUSTOM_PRESETS[found.mode || 'light'], ...found.tokens },
        });
      }
    }
    // Reacting to `draft.mode` here would reset the draft mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, customThemes]);

  const setToken = (key, value) =>
    setDraft((prev) => ({ ...prev, tokens: { ...prev.tokens, [key]: value } }));

  const switchMode = (mode) =>
    setDraft((prev) => ({
      ...prev,
      mode,
      base: mode,
      tokens: { ...CUSTOM_PRESETS[mode], ...(prev.id ? prev.tokens : {}) },
    }));

  const autoFill = () => {
    const accent = HEX_RE.test(draft.tokens.accent) ? draft.tokens.accent : '#4F46E5';
    setDraft((prev) => ({ ...prev, tokens: paletteFromAccent(accent, prev.mode) }));
    toast.success('Palette rebuilt from your accent');
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error('Give the theme a name');
      return;
    }
    const saved = await saveCustomTheme(draft);
    if (saved) setEditing(null);
  };

  /* The live preview swatch shows the draft, not the applied theme, so
     the user can see a palette before committing to it. */
  const previewStyle = useMemo(() => {
    const style = {};
    for (const [key, value] of Object.entries(draft.tokens || {})) {
      if (HEX_RE.test(value)) style[`--p-${key}`] = value;
    }
    return style;
  }, [draft.tokens]);

  return (
    <div className="studio">
      {/* ── Built-in themes ──────────────────────────────── */}
      <section className="studio-section">
        <div className="section-head">
          <h2><Palette size={16} /> Theme</h2>
          <span className="section-head-sub">
            {unlocked ? `All ${THEMES.length} unlocked` : `3 of ${THEMES.length} available`}
          </span>
        </div>

        <div className="studio-grid">
          {themes.map((theme) => {
            const allowed = canUse(theme.id);
            const active = themeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                className={`studio-card ${active ? 'active' : ''} ${allowed ? '' : 'is-locked'}`}
                onClick={() => (allowed ? setTheme(theme.id) : null)}
                aria-pressed={active}
                aria-disabled={!allowed}
              >
                <span className="studio-card-preview">
                  {theme.swatch.map((color, i) => (
                    <i key={i} style={{ background: color }} />
                  ))}
                  <em style={{ background: theme.swatch[2] }} />
                </span>

                <span className="studio-card-body">
                  <strong>
                    {theme.mode === 'dark' ? <Moon size={11} /> : <Sun size={11} />}
                    {theme.label}
                  </strong>
                  <span>{theme.description}</span>
                </span>

                {active && <Check size={15} className="studio-card-check" />}
                {!allowed && (
                  <span className="lock-badge">
                    <Lock size={9} /> Platinum
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {!unlocked && (
          <Link to="/upgrade" className="studio-upsell">
            <Crown size={15} />
            <div>
              <strong>Six more themes with Platinum</strong>
              <span>Aurora, Sunset, Nord, Rosé, Forest and Monochrome — plus a palette builder.</span>
            </div>
            <span className="studio-upsell-arrow">→</span>
          </Link>
        )}
      </section>

      {/* ── Custom palettes ──────────────────────────────── */}
      <section className={`studio-section ${unlocked ? '' : 'is-gated'}`}>
        <div className="section-head">
          <h2><Wand2 size={16} /> Your palettes</h2>
          <span className="section-head-sub">
            {unlocked
              ? `${customThemes.length} of ${maxCustomThemes} saved`
              : 'Platinum feature'}
          </span>
        </div>

        {!unlocked ? (
          <div className="studio-locked-panel">
            <span className="lock-badge" style={{ position: 'static' }}>
              <Crown size={9} /> Platinum
            </span>
            <p>
              The palette builder lets you set all sixteen theme tokens by hand, preview
              them live, and keep up to {maxCustomThemes} palettes that sync to every device
              you sign in on.
            </p>
            <Link to="/upgrade" className="btn btn-primary btn-sm">See what Platinum includes</Link>
          </div>
        ) : (
          <>
            <div className="studio-grid">
              {customThemes.map((theme) => (
                <div
                  key={theme.id}
                  className={`studio-card studio-card--custom ${themeId === theme.id ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    className="studio-card-hit"
                    onClick={() => setTheme(theme.id)}
                    aria-pressed={themeId === theme.id}
                  >
                    <span className="studio-card-preview">
                      <i style={{ background: theme.tokens['bg-primary'] || '#888' }} />
                      <i style={{ background: theme.tokens['bg-card'] || '#aaa' }} />
                      <i style={{ background: theme.tokens.accent || '#4F46E5' }} />
                      <em style={{ background: theme.tokens.accent || '#4F46E5' }} />
                    </span>
                    <span className="studio-card-body">
                      <strong>
                        {theme.mode === 'dark' ? <Moon size={11} /> : <Sun size={11} />}
                        {theme.name}
                      </strong>
                      <span>Custom palette</span>
                    </span>
                  </button>

                  <div className="studio-card-actions">
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      onClick={() => setEditing(theme.id)}
                      aria-label={`Edit ${theme.name}`}
                      title="Edit"
                    >
                      <Palette size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm icon-btn-danger"
                      onClick={() => deleteCustomTheme(theme.id)}
                      aria-label={`Delete ${theme.name}`}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {themeId === theme.id && <Check size={15} className="studio-card-check" />}
                </div>
              ))}

              {customThemes.length < maxCustomThemes && (
                <button
                  type="button"
                  className="studio-card studio-card--new"
                  onClick={() => setEditing('new')}
                >
                  <Plus size={20} />
                  <strong>New palette</strong>
                  <span>Start from a preset</span>
                </button>
              )}
            </div>

            {/* ── Editor ───────────────────────────────────── */}
            {editing && (
              <div className="studio-editor" style={previewStyle}>
                <div className="studio-editor-head">
                  <input
                    className="studio-name"
                    value={draft.name}
                    onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Palette name"
                    maxLength={40}
                    aria-label="Palette name"
                  />

                  <div className="segmented">
                    <button
                      type="button"
                      className={draft.mode === 'light' ? 'active' : ''}
                      onClick={() => switchMode('light')}
                    >
                      <Sun size={12} /> Light
                    </button>
                    <button
                      type="button"
                      className={draft.mode === 'dark' ? 'active' : ''}
                      onClick={() => switchMode('dark')}
                    >
                      <Moon size={12} /> Dark
                    </button>
                  </div>

                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setEditing(null)}
                    aria-label="Close editor"
                  >
                    <X size={17} />
                  </button>
                </div>

                {/* A miniature of the app, painted in the draft's tokens. */}
                <div className="studio-preview">
                  <div className="studio-preview-chrome">
                    <span className="studio-preview-sidebar">
                      <i /><i /><i className="on" /><i />
                    </span>
                    <span className="studio-preview-body">
                      <span className="studio-preview-bar" />
                      <span className="studio-preview-card">
                        <b />
                        <em />
                        <span className="studio-preview-btn">Button</span>
                      </span>
                      <span className="studio-preview-card">
                        <b />
                        <em />
                      </span>
                    </span>
                  </div>
                </div>

                <div className="studio-fields">
                  {GROUPS.map(([group, fields]) => (
                    <div key={group} className="studio-field-group">
                      <h4>{group}</h4>
                      {fields.map((field) => {
                        const value = draft.tokens[field.key] || '';
                        const valid = HEX_RE.test(value);
                        return (
                          <label key={field.key} className="studio-field">
                            <span>{field.label}</span>
                            <input
                              type="color"
                              value={valid ? value : '#000000'}
                              onChange={(e) => setToken(field.key, e.target.value)}
                              aria-label={`${field.label} colour picker`}
                            />
                            <input
                              type="text"
                              className={`studio-hex ${valid ? '' : 'is-invalid'}`}
                              value={value}
                              onChange={(e) => setToken(field.key, e.target.value)}
                              placeholder="#000000"
                              maxLength={7}
                              spellCheck={false}
                              aria-label={`${field.label} hex value`}
                            />
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="studio-editor-foot">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={autoFill}>
                    <Wand2 size={13} /> Build from accent
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setDraft((p) => ({ ...p, tokens: { ...CUSTOM_PRESETS[p.mode] } }))}
                  >
                    <RotateCcw size={13} /> Reset
                  </button>
                  <div className="grow" />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                    <Save size={13} /> {saving ? 'Saving…' : 'Save & apply'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Layout preferences ───────────────────────────── */}
      <section className="studio-section">
        <div className="section-head">
          <h2>Layout</h2>
          <span className="section-head-sub">Applies everywhere, on every device</span>
        </div>

        <div className="studio-prefs">
          <div className="studio-pref">
            <div className="switch-row-copy">
              <strong>Density</strong>
              <span>{DENSITIES.find((d) => d.id === density)?.description}</span>
            </div>
            <div className="segmented">
              {DENSITIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={density === d.id ? 'active' : ''}
                  onClick={() => setDensity(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="studio-pref">
            <div className="switch-row-copy">
              <strong>Text size</strong>
              <span>Scales every size in the app — currently {fontScale}%.</span>
            </div>
            <div className="studio-scale">
              <span>A</span>
              <input
                type="range"
                min={85}
                max={125}
                step={5}
                value={fontScale}
                onChange={(e) => setFontScale(Number(e.target.value))}
                aria-label="Text size"
              />
              <span style={{ fontSize: '1.15em' }}>A</span>
            </div>
          </div>

          <div className="switch-row">
            <div className="switch-row-copy">
              <strong>Reduce motion</strong>
              <span>Turns off the entrance animations and hover lifts.</span>
            </div>
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={reducedMotion}
              aria-label="Reduce motion"
              onClick={() => setReducedMotion(!reducedMotion)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
