import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, BookOpen, Tv, Table, PenLine, StickyNote,
  Target, Flame, ChevronDown, X, Shield, Settings, IndianRupee, Sun,
  Inbox, Timer, BarChart3, Archive, Sparkles, Crown,
} from 'lucide-react';
import { format } from 'date-fns';
import useMediaQuery, { MOBILE_QUERY } from '../hooks/useMediaQuery';
import useFocusTrap from '../hooks/useFocusTrap';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

/* Grouped so the sidebar reads as four jobs — plan the day, do the work,
   keep the library, look back — rather than one flat list of fourteen. */
const NAV_GROUPS = [
  {
    label: 'Today',
    items: [
      { to: '/today', icon: Sun, label: 'My Day' },
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/analytics', icon: BarChart3, label: 'Insights' },
      { to: '/inbox', icon: Inbox, label: 'Inbox' },
      { to: '/focus', icon: Timer, label: 'Focus' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { to: '/notes', icon: PenLine, label: 'Notebook' },
      { to: '/stickynotes', icon: StickyNote, label: 'Sticky Notes' },
      { to: '/tables', icon: Table, label: 'Tables' },
      { to: '/projects', icon: FolderKanban, label: 'Projects', hideOnMobile: true, requiresDeveloper: true },
    ],
  },
  {
    label: 'Progress',
    items: [
      { to: '/goals', icon: Target, label: 'Goals' },
      { to: '/habits', icon: Flame, label: 'Habits' },
      { to: '/money', icon: IndianRupee, label: 'Money' },
    ],
  },
  {
    label: 'Library',
    items: [
      { to: '/books', icon: BookOpen, label: 'Books' },
      { to: '/shows', icon: Tv, label: 'Shows' },
      { to: '/archive', icon: Archive, label: 'Archive' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
      { to: '/admin', icon: Shield, label: 'Admin', requiresAdmin: true },
    ],
  },
];

const COLLAPSE_KEY = 'sortlife_sidebar_collapsed';
const GROUPS_KEY = 'sortlife_sidebar_groups';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function Sidebar({ open, onClose }) {
  const today = format(new Date(), 'EEE, MMM d');
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { isDeveloper, isAdmin, user, plan } = useAuth();

  const [collapsedGroups, setCollapsedGroups] = useState(() => readJson(GROUPS_KEY, {}));
  // The rail is a desktop affordance; on mobile the drawer is the answer.
  // The docked sidebar is always expanded now; the old rail toggle is gone.
  const railed = false;

  useEffect(() => {
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(collapsedGroups)); } catch { /* ignore */ }
  }, [collapsedGroups]);

  /* The width lives in CSS, driven by this attribute. Writing --sidebar-w
     inline on <html> used to beat every `@media` override of the token,
     so the tablet and mobile widths never applied. */
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(railed)); } catch { /* ignore */ }
    const root = document.documentElement;
    if (railed) root.setAttribute('data-rail', 'on');
    else root.removeAttribute('data-rail');
  }, [railed]);

  const toggleGroup = useCallback((label) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (isMobile && item.hideOnMobile) return false;
      if (item.requiresDeveloper && !isDeveloper) return false;
      if (item.requiresAdmin && !isAdmin) return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  const isRail = railed && !isMobile;

  /* Open as a drawer it is a modal surface: Tab must not walk onto the page
     underneath, Escape must close it, and the page must not scroll behind
     it. As a docked rail it is just page furniture, so the trap stays off. */
  const drawerOpen = open && isMobile;
  const drawerRef = useFocusTrap(drawerOpen, { onEscape: onClose, autoFocus: false });

  return (
    <aside
      ref={drawerRef}
      className={`sidebar ${open ? 'sidebar--open' : ''} ${isRail ? 'sidebar--rail' : ''}`}
      aria-label="Main navigation"
      aria-hidden={isMobile && !open ? 'true' : undefined}
      inert={isMobile && !open ? '' : undefined}
      role={drawerOpen ? 'dialog' : undefined}
      aria-modal={drawerOpen ? 'true' : undefined}
    >
      <div className="sidebar-head">
        <Link to="/" className="sidebar-brand" onClick={onClose}>
          <span className="sidebar-brand-mark" aria-hidden>
            <Sparkles size={17} />
          </span>
          <span className="sidebar-brand-text">SortLife</span>
        </Link>

        <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
          <X size={19} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {visibleGroups.map((group) => {
          const isCollapsed = !!collapsedGroups[group.label];
          return (
            <div key={group.label} className="sidebar-group">
              <button
                className="sidebar-group-label"
                onClick={() => toggleGroup(group.label)}
                aria-expanded={!isCollapsed}
              >
                <span>{group.label}</span>
                <ChevronDown
                  size={13}
                  className={`sidebar-chevron ${isCollapsed ? 'is-closed' : ''}`}
                />
              </button>

              <div className={`sidebar-group-items ${isCollapsed ? 'is-collapsed' : ''}`}>
                {group.items.map(({ to, icon: Icon, label, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                    onClick={onClose}
                    title={isRail ? label : undefined}
                  >
                    <span className="sidebar-link-icon"><Icon size={17} /></span>
                    <span className="sidebar-link-label">{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {plan === 'platinum' ? (
          <div className="sidebar-plan sidebar-plan--platinum">
            <Crown size={14} />
            <div>
              <strong>Platinum</strong>
              <span>All themes unlocked</span>
            </div>
          </div>
        ) : (
          <Link to="/upgrade" className="sidebar-plan sidebar-plan--upsell" onClick={onClose}>
            <Crown size={14} />
            <div>
              <strong>Go Platinum</strong>
              <span>9 themes + custom palettes</span>
            </div>
          </Link>
        )}
        <p className="sidebar-date">
          {today}
          {user?.name ? ` · ${user.name.split(' ')[0]}` : ''}
        </p>
      </div>
    </aside>
  );
}
