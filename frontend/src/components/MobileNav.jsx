import React from 'react';
import { NavLink } from 'react-router-dom';
import { Sun, LayoutDashboard, Plus, Flame, Menu } from 'lucide-react';
import './MobileNav.css';

/* Four destinations plus a capture button. Anything beyond that stops
   being a thumb target and starts being a menu — which is what the
   drawer is for. */
const ITEMS = [
  { to: '/today', icon: Sun, label: 'Day' },
  { to: '/', icon: LayoutDashboard, label: 'Home', end: true },
  { to: '/habits', icon: Flame, label: 'Habits' },
];

export default function MobileNav({ onQuickCapture, onMenu }) {
  return (
    <nav className="mobile-nav" aria-label="Primary">
      {ITEMS.slice(0, 2).map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
        >
          <Icon size={19} />
          <span>{label}</span>
        </NavLink>
      ))}

      <button
        type="button"
        className="mobile-nav-fab"
        onClick={onQuickCapture}
        aria-label="Quick capture"
      >
        <Plus size={22} />
      </button>

      {ITEMS.slice(2).map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
        >
          <Icon size={19} />
          <span>{label}</span>
        </NavLink>
      ))}

      <button type="button" className="mobile-nav-item" onClick={onMenu} aria-label="More">
        <Menu size={19} />
        <span>More</span>
      </button>
    </nav>
  );
}
