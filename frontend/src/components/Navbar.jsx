import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Menu, LogOut, Settings, Crown, Sun, Moon, Palette, Check,
  Lock, ChevronDown, Keyboard, BarChart3, Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getApiBase } from '../utils/api';
import NotificationBell from './NotificationBell';
import './Navbar.css';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

function initialsOf(name) {
  return (name || '?')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Close on outside click and on Escape — every popover here needs both. */
function useDismiss(ref, onDismiss, active) {
  useEffect(() => {
    if (!active) return undefined;
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onDismiss();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, onDismiss, active]);
}

export default function Navbar({ title, subtitle, onMenuClick, onSearchClick, onShortcuts }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme, themes, themeId, setTheme, canUse, customThemes, unlocked } =
    useTheme();
  const navigate = useNavigate();

  const [themeOpen, setThemeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const themeRef = useRef(null);
  const menuRef = useRef(null);

  useDismiss(themeRef, () => setThemeOpen(false), themeOpen);
  useDismiss(menuRef, () => setMenuOpen(false), menuOpen);

  const plan = user?.plan || 'common';
  const showBadge = plan === 'premium' || plan === 'platinum';
  const avatar = user?.avatarUrl
    ? user.avatarUrl.startsWith('http')
      ? user.avatarUrl
      : `${getApiBase()}${user.avatarUrl}`
    : null;

  const pickTheme = (id) => {
    if (setTheme(id)) setThemeOpen(false);
  };

  return (
    <header className="navbar">
      <button className="navbar-menu-btn" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={20} />
      </button>

      <div className="navbar-titles">
        <h1 className="navbar-title">{title}</h1>
        {subtitle && <p className="navbar-subtitle">{subtitle}</p>}
      </div>

      {/* A button, not an input: typing happens in the command palette,
          so the control that opens it should announce itself as such. */}
      <button
        type="button"
        className="navbar-search"
        onClick={onSearchClick}
        aria-label="Search"
        aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
      >
        <Search size={15} className="navbar-search-icon" aria-hidden="true" />
        <span className="navbar-search-label">Search everything…</span>
        <kbd className="navbar-search-kbd">{IS_MAC ? '⌘' : 'Ctrl'} K</kbd>
      </button>

      <div className="navbar-right">
        <button
          type="button"
          className="navbar-icon-btn navbar-search-mobile"
          onClick={onSearchClick}
          aria-label="Search"
        >
          <Search size={18} />
        </button>

        <NotificationBell />

        {/* Quick light/dark flip — the palette gallery is one click deeper. */}
        <button
          type="button"
          className="navbar-icon-btn"
          onClick={toggleTheme}
          title={isDark ? 'Switch to a light theme' : 'Switch to a dark theme'}
          aria-label={isDark ? 'Switch to a light theme' : 'Switch to a dark theme'}
        >
          <span className={`navbar-theme-swap ${isDark ? 'is-dark' : ''}`}>
            <Sun size={17} className="navbar-theme-sun" />
            <Moon size={17} className="navbar-theme-moon" />
          </span>
        </button>

        <div className="navbar-pop" ref={themeRef}>
          <button
            type="button"
            className={`navbar-icon-btn ${themeOpen ? 'is-open' : ''}`}
            onClick={() => setThemeOpen((v) => !v)}
            aria-label="Choose a theme"
            aria-expanded={themeOpen}
            aria-haspopup="menu"
          >
            <Palette size={18} />
          </button>

          {themeOpen && (
            <div className="navbar-menu navbar-menu--themes" role="menu">
              <div className="navbar-menu-head">
                <span>Theme</span>
                <Link to="/settings#appearance" onClick={() => setThemeOpen(false)}>
                  All settings
                </Link>
              </div>

              <div className="theme-swatch-grid">
                {themes.map((theme) => {
                  const allowed = canUse(theme.id);
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={themeId === theme.id}
                      className={`theme-swatch ${themeId === theme.id ? 'active' : ''} ${allowed ? '' : 'locked-swatch'}`}
                      onClick={() => (allowed ? pickTheme(theme.id) : navigate('/upgrade'))}
                      title={allowed ? theme.description : `${theme.label} — Platinum`}
                    >
                      <span className="theme-swatch-colors">
                        {theme.swatch.map((color, i) => (
                          <i key={i} style={{ background: color }} />
                        ))}
                      </span>
                      <span className="theme-swatch-name">{theme.label}</span>
                      {themeId === theme.id && <Check size={13} className="theme-swatch-check" />}
                      {!allowed && <Lock size={11} className="theme-swatch-lock" />}
                    </button>
                  );
                })}
              </div>

              {unlocked && customThemes.length > 0 && (
                <>
                  <div className="navbar-menu-sep">Your palettes</div>
                  <div className="theme-swatch-grid">
                    {customThemes.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={themeId === theme.id}
                        className={`theme-swatch ${themeId === theme.id ? 'active' : ''}`}
                        onClick={() => pickTheme(theme.id)}
                      >
                        <span className="theme-swatch-colors">
                          <i style={{ background: theme.tokens['bg-primary'] || '#888' }} />
                          <i style={{ background: theme.tokens['bg-card'] || '#aaa' }} />
                          <i style={{ background: theme.tokens.accent || '#4F46E5' }} />
                        </span>
                        <span className="theme-swatch-name">{theme.name}</span>
                        {themeId === theme.id && <Check size={13} className="theme-swatch-check" />}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {!unlocked && (
                <Link
                  to="/upgrade"
                  className="navbar-menu-upsell"
                  onClick={() => setThemeOpen(false)}
                >
                  <Crown size={13} />
                  Unlock 6 more themes + custom palettes
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="navbar-pop" ref={menuRef}>
          <button
            type="button"
            className={`navbar-user-btn ${menuOpen ? 'is-open' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
          >
            <span className={`navbar-avatar plan-${plan}`}>
              {avatar
                ? <img src={avatar} alt="" />
                : initialsOf(user?.name)}
            </span>
            <span className="navbar-user-copy">
              <span className="navbar-user-name">{user?.name || 'Account'}</span>
              <span className="navbar-user-sub">{getGreeting()}</span>
            </span>
            <ChevronDown size={14} className={`navbar-user-caret ${menuOpen ? 'is-open' : ''}`} />
          </button>

          {menuOpen && (
            <div className="navbar-menu" role="menu">
              <div className="navbar-menu-identity">
                <span className={`navbar-avatar plan-${plan}`}>
                  {avatar ? <img src={avatar} alt="" /> : initialsOf(user?.name)}
                </span>
                <div>
                  <strong>{user?.name}</strong>
                  <span>{user?.email}</span>
                  {showBadge && (
                    <span className={`navbar-plan-badge ${plan}`}>
                      <Crown size={10} />
                      {plan === 'platinum' ? 'Platinum' : 'Premium'}
                    </span>
                  )}
                </div>
              </div>

              <Link to="/settings" role="menuitem" onClick={() => setMenuOpen(false)}>
                <Settings size={15} /> Settings
              </Link>
              <Link to="/analytics" role="menuitem" onClick={() => setMenuOpen(false)}>
                <BarChart3 size={15} /> Insights
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); onShortcuts?.(); }}
              >
                <Keyboard size={15} /> Keyboard shortcuts <kbd>?</kbd>
              </button>
              {plan !== 'platinum' && (
                <Link to="/upgrade" role="menuitem" onClick={() => setMenuOpen(false)}>
                  <Sparkles size={15} /> Upgrade plan
                </Link>
              )}

              <div className="navbar-menu-divider" />

              <button type="button" role="menuitem" className="is-danger" onClick={logout}>
                <LogOut size={15} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
