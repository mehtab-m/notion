import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, BookOpen, Tv, Table, Grid2x2 } from 'lucide-react';
import { format } from 'date-fns';
import './Sidebar.css';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/books', icon: BookOpen, label: 'Books' },
  { to: '/shows', icon: Tv, label: 'Shows' },
  { to: '/tables', icon: Table, label: 'Tables' },
];

export default function Sidebar() {
  const today = format(new Date(), 'EEE, MMM d yyyy');

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Grid2x2 size={22} color="var(--accent)" />
        <span className="sidebar-logo-text">My Notion</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p className="sidebar-date">{today}</p>
      </div>
    </aside>
  );
}
