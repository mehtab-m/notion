import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Menu, LogOut, Settings, Crown, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './Navbar.css';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

export default function Navbar({ title, onMenuClick, onSearchClick }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const plan = user?.plan || 'common';
  const showBadge = plan === 'premium' || plan === 'platinum';

  return (
    <header className="navbar">
      <button className="navbar-menu-btn" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={20} />
      </button>
      <h1 className="navbar-title">{title}</h1>

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
        <span className="navbar-search-label">Search…</span>
        <kbd className="navbar-search-kbd">{IS_MAC ? '⌘' : 'Ctrl'} K</kbd>
      </button>

      <div className="navbar-right">
        {user && (
          <div className="navbar-user-info" title={user.email}>
            <div className="navbar-user-row">
              <span className="navbar-user">{user.name}</span>
              {showBadge && (
                <span className={`navbar-plan-badge ${plan}`}>
                  <Crown size={11} />
                  {plan === 'platinum' ? 'Platinum' : 'Premium'}
                </span>
              )}
            </div>
            <span className="navbar-user-email">{user.email}</span>
          </div>
        )}
        <span className="navbar-greeting">{getGreeting()}</span>

        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={isDark}
        >
          <span className="theme-toggle-track">
            <span className="theme-toggle-thumb">
              {isDark ? <Moon size={12} /> : <Sun size={12} />}
            </span>
          </span>
        </button>

        <Link to="/settings" className="navbar-logout" title="Settings" aria-label="Settings">
          <Settings size={16} />
        </Link>

        <button className="navbar-logout" onClick={logout} title="Log out" aria-label="Log out">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
