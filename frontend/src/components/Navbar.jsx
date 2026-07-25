import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Menu, LogOut, Settings, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Navbar({ title, onMenuClick }) {
  const [searchVal, setSearchVal] = useState('');
  const { user, logout } = useAuth();
  const plan = user?.plan || 'common';
  const showBadge = plan === 'premium' || plan === 'platinum';

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

        <Link to="/settings" className="navbar-logout" title="Settings" aria-label="Settings">
          <Settings size={16} />
        </Link>

        <button className="navbar-logout" onClick={logout} title="Log out">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
