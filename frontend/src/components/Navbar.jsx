import React, { useState } from 'react';
import { Search, Sun, Moon, Menu } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import './Navbar.css';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Navbar({ title, onMenuClick }) {
  const [searchVal, setSearchVal] = useState('');
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="navbar">
      <button className="navbar-menu-btn" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={20} />
      </button>
      <h1 className="navbar-title">{title}</h1>

      <div className="navbar-search">
        <Search size={15} className="navbar-search-icon" />
        <input
          type="text"
          placeholder="Search..."
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          className="navbar-search-input"
        />
      </div>

      <div className="navbar-right">
        <span className="navbar-greeting">{getGreeting()} 👋</span>

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          <span className="theme-toggle-track">
            <span className="theme-toggle-thumb">
              {theme === 'dark' ? (
                <Moon size={12} strokeWidth={2.5} />
              ) : (
                <Sun size={12} strokeWidth={2.5} />
              )}
            </span>
          </span>
        </button>
      </div>
    </header>
  );
}
