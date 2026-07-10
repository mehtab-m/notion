import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, BookOpen, Tv, Table,
  Grid2x2, PenLine, StickyNote, Target, Flame, ChevronDown, ChevronRight, X,
} from 'lucide-react';
import { format } from 'date-fns';
import useMediaQuery, { MOBILE_QUERY } from '../hooks/useMediaQuery';
import './Sidebar.css';

const NAV_GROUPS = [
  {
    label: 'WORKSPACE',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/notes', icon: PenLine, label: 'Notebook' },
      { to: '/stickynotes', icon: StickyNote, label: 'Sticky Notes' },
    ],
  },
  {
    label: 'PRODUCTIVITY',
    items: [
      { to: '/projects', icon: FolderKanban, label: 'Projects', hideOnMobile: true },
      { to: '/goals', icon: Target, label: 'Goals' },
      { to: '/habits', icon: Flame, label: 'Habits' },
    ],
  },
  {
    label: 'LIBRARY',
    items: [
      { to: '/books', icon: BookOpen, label: 'Books' },
      { to: '/shows', icon: Tv, label: 'Shows' },
    ],
  },
  {
    label: 'DATA',
    items: [
      { to: '/tables', icon: Table, label: 'Tables' },
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  const today = format(new Date(), 'EEE, MMM d yyyy');
  const [collapsed, setCollapsed] = useState({});
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const toggleGroup = (label) =>
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !(isMobile && item.hideOnMobile)),
  })).filter((group) => group.items.length > 0);

  return (
    <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
      <div className="sidebar-logo">
        <Grid2x2 size={22} color="var(--accent)" />
        <span className="sidebar-logo-text">SortLife</span>
        <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {visibleGroups.map((group) => (
          <div key={group.label} className="sidebar-group">
            <button
              className="sidebar-group-label"
              onClick={() => toggleGroup(group.label)}
            >
              <span>{group.label}</span>
              {collapsed[group.label]
                ? <ChevronRight size={12} />
                : <ChevronDown size={12} />}
            </button>
            {!collapsed[group.label] && group.items.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                onClick={onClose}
              >
                <Icon size={17} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p className="sidebar-date">{today}</p>
      </div>
    </aside>
  );
}
