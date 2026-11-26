/* ─── Notification bell ────────────────────────────────────
   Polls GET /api/notifications (every 2 min, on focus, and when
   Settings changes a preference). Read state lives on the server
   so it follows you across devices.                          */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, AlertTriangle, Clock, Flame, CalendarClock, CheckCheck, Settings } from 'lucide-react';
import { getNotifications, markNotificationsRead, markAllNotificationsRead } from '../utils/api';
import './NotificationBell.css';

const ICONS = { overdue: AlertTriangle, due: Clock, habit: Flame, reminder: CalendarClock };
const POLL_MS = 2 * 60 * 1000;

export default function NotificationBell() {
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      setData(await getNotifications());
    } catch {
      /* The bell is ambient — never toast on a failed poll. */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    window.addEventListener('sortlife:notifications-changed', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('sortlife:notifications-changed', onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = async (item) => {
    setOpen(false);
    if (!item.read) {
      setData((d) => ({
        items: d.items.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
        unread: Math.max(0, d.unread - 1),
      }));
      markNotificationsRead([item.id]).catch(() => {});
    }
    if (item.url) navigate(item.url);
  };

  const readAll = async () => {
    setData((d) => ({ items: d.items.map((n) => ({ ...n, read: true })), unread: 0 }));
    try { await markAllNotificationsRead(); } catch { load(); }
  };

  return (
    <div className="nbell" ref={ref}>
      <button
        type="button"
        className={`navbar-icon-btn nbell-btn ${open ? 'is-open' : ''}`}
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        aria-label={data.unread ? `${data.unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Bell size={18} />
        {data.unread > 0 && <span className="nbell-badge">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>

      {open && (
        <div className="nbell-menu" role="menu">
          <div className="nbell-head">
            <strong>Notifications</strong>
            <div>
              {data.unread > 0 && (
                <button type="button" onClick={readAll}><CheckCheck size={13} /> Mark all read</button>
              )}
              <Link to="/settings#notifications" onClick={() => setOpen(false)} aria-label="Notification settings"><Settings size={14} /></Link>
            </div>
          </div>
          {data.items.length === 0 ? (
            <div className="nbell-empty">
              <Bell size={22} />
              <p>You're all caught up.</p>
              <span>Overdue tasks, goal follow-ups and habit nudges show up here.</span>
            </div>
          ) : (
            <ul className="nbell-list">
              {data.items.slice(0, 30).map((item) => {
                const Icon = ICONS[item.type] || Bell;
                return (
                  <li key={item.id}>
                    <button type="button" className={`nbell-item t-${item.type} ${item.read ? 'is-read' : ''}`} onClick={() => openItem(item)}>
                      <span className="nbell-icon"><Icon size={14} /></span>
                      <span className="nbell-copy">
                        <strong>{item.title}</strong>
                        <em>{item.body}</em>
                      </span>
                      {!item.read && <i className="nbell-dot" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
