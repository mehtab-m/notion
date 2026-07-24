import React, { useEffect, useState, useCallback } from 'react';
import {
  Users, UserCheck, UserX, Code2, Activity, BookOpen, Tv, Flame, Target, FolderKanban, PenLine,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { getAdminStats, updateAdminUser } from '../utils/api';
import './AdminDashboard.css';

const PIE_COLORS = ['#10b981', '#ef4444'];

function StatTile({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="admin-stat-tile">
      <div className="admin-stat-icon" style={{ color, background: `${color}18` }}>
        <Icon size={18} />
      </div>
      <div>
        <p className="admin-stat-value">{value}</p>
        <p className="admin-stat-label">{label}</p>
        {sub && <p className="admin-stat-sub">{sub}</p>}
      </div>
    </div>
  );
}

function reasonLabel(reason) {
  if (reason === 'grace_period') return 'New (7-day grace)';
  if (reason === 'weekly_activity') return 'Active (≥10/week)';
  return 'Inactive';
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | active | inactive | developers

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stats = await getAdminStats();
      setData(stats);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load admin stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleRole = async (user) => {
    const next = user.role === 'admin' ? 'user' : 'admin';
    try {
      await updateAdminUser(user._id, { role: next });
      toast.success(`${user.name} is now ${next}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update role');
    }
  };

  if (loading && !data) {
    return (
      <div className="spinner-container">
        <div className="spinner" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <Users size={40} strokeWidth={1} />
        <h3>No admin data</h3>
        <p>Could not load product analytics.</p>
      </div>
    );
  }

  const { overview, contentTotals, signupsByDay, users } = data;

  const activityPie = [
    { name: 'Active', value: overview.activeUsers },
    { name: 'Inactive', value: overview.inactiveUsers },
  ];

  const filteredUsers = users.filter((u) => {
    if (filter === 'active') return u.isActive;
    if (filter === 'inactive') return !u.isActive;
    if (filter === 'developers') return u.isDeveloper === true;
    return true;
  });

  const chartData = (signupsByDay || []).map((d) => ({
    day: d.day,
    label: (() => {
      try { return format(parseISO(d.day), 'MMM d'); } catch { return d.day; }
    })(),
    count: d.count,
  }));

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Product Admin</h1>
          <p className="admin-lede">
            Users, activity, and content analytics. Active = ≥{overview.activeThreshold} app uses/logins in 7 days,
            or within the first {overview.graceDays} days (grace).
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="admin-stat-grid">
        <StatTile icon={Users} label="Total users" value={overview.totalUsers} color="var(--accent)" />
        <StatTile icon={UserCheck} label="Active users" value={overview.activeUsers} sub={`${overview.inGracePeriod} in grace`} color="var(--accent-green)" />
        <StatTile icon={UserX} label="Inactive users" value={overview.inactiveUsers} color="var(--accent-red)" />
        <StatTile icon={Code2} label="Developers" value={overview.developers} sub={`${overview.nonDevelopers} non-dev · ${overview.undecidedDeveloper} undecided`} color="var(--accent-blue)" />
        <StatTile icon={Activity} label="Week activity events" value={overview.weeklyActivityEvents} sub={`${overview.newThisWeek} new this week`} color="var(--accent-yellow)" />
      </div>

      <div className="admin-content-totals">
        <span><BookOpen size={14} /> {contentTotals.books} books</span>
        <span><Tv size={14} /> {contentTotals.shows} shows</span>
        <span><Flame size={14} /> {contentTotals.habits} habits</span>
        <span><Target size={14} /> {contentTotals.goals} goals</span>
        <span><FolderKanban size={14} /> {contentTotals.projects} projects</span>
        <span><PenLine size={14} /> {contentTotals.notes} notes</span>
      </div>

      <div className="admin-charts">
        <div className="admin-chart-panel">
          <h2>Signups (30 days)</h2>
          {chartData.length === 0 ? (
            <p className="admin-empty-chart">No signups in this window.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#signupFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="admin-chart-panel">
          <h2>Active vs inactive</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={activityPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
                {activityPie.map((entry, i) => (
                  <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="admin-pie-legend">
            <span><i style={{ background: PIE_COLORS[0] }} /> Active {overview.activeUsers}</span>
            <span><i style={{ background: PIE_COLORS[1] }} /> Inactive {overview.inactiveUsers}</span>
          </div>
        </div>
      </div>

      <div className="admin-users-header">
        <h2>Users & analytics</h2>
        <div className="admin-filters">
          {[
            ['all', 'All'],
            ['active', 'Active'],
            ['inactive', 'Inactive'],
            ['developers', 'Developers'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`admin-filter-btn ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Developer</th>
              <th>Week uses</th>
              <th>Content</th>
              <th>Joined</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u._id}>
                <td>
                  <div className="admin-user-cell">
                    <strong>{u.name}</strong>
                    <span>{u.email}</span>
                  </div>
                </td>
                <td>
                  <span className={`admin-pill ${u.isActive ? 'on' : 'off'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="admin-reason">{reasonLabel(u.activeReason)}</span>
                </td>
                <td>
                  {u.isDeveloper === true ? 'Yes' : u.isDeveloper === false ? 'No' : '—'}
                </td>
                <td>
                  <strong>{u.weekActivityCount}</strong>
                  <span className="admin-muted"> / {u.totalActivityCount} total</span>
                </td>
                <td className="admin-content-cell">
                  B{u.content.books} · S{u.content.shows} · H{u.content.habits} · G{u.content.goals} · P{u.content.projects}
                </td>
                <td>
                  {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '—'}
                  {u.lastActiveAt && (
                    <span className="admin-muted block">
                      Last {format(new Date(u.lastActiveAt), 'MMM d HH:mm')}
                    </span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className={`admin-role-btn ${u.role === 'admin' ? 'admin' : ''}`}
                    onClick={() => toggleRole(u)}
                    title="Toggle admin role"
                  >
                    {u.role === 'admin' ? 'Admin' : 'User'}
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={7} className="admin-empty-row">No users match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
