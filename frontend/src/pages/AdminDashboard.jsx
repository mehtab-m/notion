import React, { useEffect, useState, useCallback } from 'react';
import {
  Users, UserCheck, UserX, Code2, Activity, BookOpen, Tv, Flame, Target, FolderKanban, PenLine,
  Table2, StickyNote, ShieldCheck, Crown, X, Scale,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { getAdminStats, updateAdminUser } from '../utils/api';
import './AdminDashboard.css';

const PIE_COLORS = ['#10b981', '#ef4444'];

function StatTile({ icon: Icon, label, value, sub }) {
  return (
    <div className="ent-stat">
      <div className="ent-stat-icon"><Icon size={16} /></div>
      <div>
        <p className="ent-stat-value">{value}</p>
        <p className="ent-stat-label">{label}</p>
        {sub && <p className="ent-stat-sub">{sub}</p>}
      </div>
    </div>
  );
}

function reasonLabel(reason, days) {
  if (reason === 'grace_period') return 'New (grace)';
  if (reason === 'recent_activity' || reason === 'weekly_activity') return `Active (≤${days || 3}d)`;
  return 'Inactive';
}

function UserDrawer({ user, onClose, onSaved }) {
  const [plan, setPlan] = useState(user.planRaw || user.plan || 'premium');
  const [role, setRole] = useState(user.role || 'user');
  const [legal, setLegal] = useState({
    marketingEmails: !!user.legalSettings?.marketingEmails,
    dataProcessing: user.legalSettings?.dataProcessing !== false,
    termsAccepted: !!user.legalSettings?.termsAccepted,
    analyticsOptIn: !!user.legalSettings?.analyticsOptIn,
    notes: user.legalSettings?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminUser(user._id, { plan, role, legalSettings: legal });
      toast.success('User updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ent-drawer-overlay" onClick={onClose}>
      <aside className="ent-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="ent-drawer-head">
          <div>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="ent-drawer-body">
          <section>
            <h3>Account</h3>
            <div className="ent-kv">
              <span>Status</span><strong>{user.isActive ? 'Active' : 'Inactive'}</strong>
              <span>Reason</span><strong>{reasonLabel(user.activeReason)}</strong>
              <span>Logins</span><strong>{user.loginCount || user.totalLogins || 0}</strong>
              <span>Last active</span>
              <strong>{user.lastActiveAt ? format(new Date(user.lastActiveAt), 'MMM d, yyyy HH:mm') : '—'}</strong>
              <span>Joined</span>
              <strong>{user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : '—'}</strong>
              <span>Developer</span>
              <strong>{user.isDeveloper === true ? 'Yes' : user.isDeveloper === false ? 'No' : 'Undecided'}</strong>
            </div>
          </section>

          <section>
            <h3>Content inventory</h3>
            <div className="ent-content-grid">
              <span>Books {user.content.books}</span>
              <span>Shows {user.content.shows}</span>
              <span>Habits {user.content.habits}</span>
              <span>Goals {user.content.goals}</span>
              <span>Projects {user.content.projects}</span>
              <span>Notes {user.content.notes}</span>
              <span>Tables {user.content.tables || 0}</span>
              <span>Stickies {user.content.stickyNotes || 0}</span>
            </div>
            <p className="ent-muted">
              Week: {user.weekLogins || 0} logins · {user.weekAppUses || 0} app uses · {user.weekActivityCount} total
            </p>
          </section>

          <section>
            <h3><Crown size={14} /> Plan</h3>
            <select value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="common">Common</option>
              <option value="premium">Premium</option>
              <option value="platinum">Platinum</option>
            </select>
            <p className="ent-muted">Effective now: {user.plan}. Expires {user.planExpiresAt ? format(new Date(user.planExpiresAt), 'MMM d, yyyy') : '—'}</p>
          </section>

          <section>
            <h3>Role</h3>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </section>

          <section>
            <h3><Scale size={14} /> Legal settings</h3>
            <label className="ent-check">
              <input type="checkbox" checked={legal.termsAccepted} onChange={(e) => setLegal((l) => ({ ...l, termsAccepted: e.target.checked }))} />
              Terms accepted
            </label>
            <label className="ent-check">
              <input type="checkbox" checked={legal.dataProcessing} onChange={(e) => setLegal((l) => ({ ...l, dataProcessing: e.target.checked }))} />
              Data processing consent
            </label>
            <label className="ent-check">
              <input type="checkbox" checked={legal.marketingEmails} onChange={(e) => setLegal((l) => ({ ...l, marketingEmails: e.target.checked }))} />
              Marketing emails
            </label>
            <label className="ent-check">
              <input type="checkbox" checked={legal.analyticsOptIn} onChange={(e) => setLegal((l) => ({ ...l, analyticsOptIn: e.target.checked }))} />
              Analytics opt-in
            </label>
            <label className="form-group" style={{ marginTop: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Admin legal notes</span>
              <textarea
                rows={3}
                value={legal.notes}
                onChange={(e) => setLegal((l) => ({ ...l, notes: e.target.value }))}
                placeholder="Internal compliance notes…"
              />
            </label>
          </section>
        </div>

        <footer className="ent-drawer-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      </aside>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

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

  if (loading && !data) {
    return <div className="spinner-container"><div className="spinner" /></div>;
  }

  if (!data) {
    return (
      <div className="empty-state">
        <Users size={40} strokeWidth={1} />
        <h3>No admin data</h3>
      </div>
    );
  }

  const { overview, contentTotals, signupsByDay, users, ethicalDataPolicy } = data;
  const inactiveDays = overview.inactiveAfterDays || 3;

  const activityPie = [
    { name: 'Active', value: overview.activeUsers },
    { name: 'Inactive', value: overview.inactiveUsers },
  ];

  const filteredUsers = users.filter((u) => {
    if (filter === 'active') return u.isActive;
    if (filter === 'inactive') return !u.isActive;
    if (filter === 'developers') return u.isDeveloper === true;
    if (filter === 'premium') return u.plan === 'premium' || u.plan === 'platinum';
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
    <div className="ent-admin">
      <header className="ent-header">
        <div>
          <p className="ent-eyebrow">Operations</p>
          <h1>Product Admin</h1>
          <p className="ent-lede">
            Enterprise user intelligence · inactive after {inactiveDays} days without activity · follow-up email on lapse
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh analytics'}
        </button>
      </header>

      <div className="ent-stat-grid">
        <StatTile icon={Users} label="Total users" value={overview.totalUsers} />
        <StatTile icon={UserCheck} label="Active" value={overview.activeUsers} sub={`${overview.inGracePeriod} in grace`} />
        <StatTile icon={UserX} label="Inactive" value={overview.inactiveUsers} />
        <StatTile icon={Crown} label="Premium / Platinum" value={`${overview.premiumUsers || 0} / ${overview.platinumUsers || 0}`} sub={`${overview.commonUsers || 0} common`} />
        <StatTile icon={Code2} label="Developers" value={overview.developers} />
        <StatTile icon={Activity} label="Week events" value={overview.weeklyActivityEvents} sub={`${overview.weeklyLogins || 0} logins · ${overview.weeklyAppUses || 0} uses`} />
      </div>

      {ethicalDataPolicy && (
        <div className="ent-policy">
          <ShieldCheck size={16} />
          <div>
            <strong>Data & ethics policy</strong>
            <p>{ethicalDataPolicy.activeRule}</p>
            <p className="ent-muted">Collected: {(ethicalDataPolicy.collected || []).join(' · ')}</p>
          </div>
        </div>
      )}

      <div className="ent-totals">
        <span><BookOpen size={13} /> {contentTotals.books} books</span>
        <span><Tv size={13} /> {contentTotals.shows} shows</span>
        <span><Flame size={13} /> {contentTotals.habits} habits</span>
        <span><Target size={13} /> {contentTotals.goals} goals</span>
        <span><FolderKanban size={13} /> {contentTotals.projects} projects</span>
        <span><PenLine size={13} /> {contentTotals.notes} notes</span>
        <span><Table2 size={13} /> {contentTotals.tables || 0} tables</span>
        <span><StickyNote size={13} /> {contentTotals.stickyNotes || 0} stickies</span>
      </div>

      <div className="ent-charts">
        <div className="ent-panel">
          <h2>Signups · 30 days</h2>
          {chartData.length === 0 ? (
            <p className="ent-muted">No signups in this window.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="signupFillEnt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#0d9488" fill="url(#signupFillEnt)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="ent-panel">
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
        </div>
      </div>

      <div className="ent-table-head">
        <h2>Directory</h2>
        <div className="ent-filters">
          {[
            ['all', 'All'],
            ['active', 'Active'],
            ['inactive', 'Inactive'],
            ['premium', 'Premium+'],
            ['developers', 'Developers'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={filter === key ? 'active' : ''}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="ent-table-wrap">
        <table className="ent-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Activity</th>
              <th>Content</th>
              <th>Legal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u._id}>
                <td>
                  <strong>{u.name}</strong>
                  <span className="ent-muted block">{u.email}</span>
                </td>
                <td>
                  <span className={`ent-pill ${u.isActive ? 'on' : 'off'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="ent-muted block">{reasonLabel(u.activeReason, inactiveDays)}</span>
                </td>
                <td>
                  <span className={`ent-plan ${u.plan}`}>{u.plan}</span>
                </td>
                <td>
                  <strong>{u.weekActivityCount}</strong> / wk
                  <span className="ent-muted block">{u.weekLogins || 0}L · {u.weekAppUses || 0}U · {u.loginCount || 0} logins</span>
                </td>
                <td className="ent-mono">
                  B{u.content.books} S{u.content.shows} H{u.content.habits} G{u.content.goals}
                </td>
                <td>
                  {u.legalSettings?.termsAccepted ? 'Terms ✓' : 'Terms —'}
                  <span className="ent-muted block">
                    {u.legalSettings?.marketingEmails ? 'Mkt' : 'No mkt'} · {u.legalSettings?.dataProcessing !== false ? 'DP' : 'No DP'}
                  </span>
                </td>
                <td>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(u)}>
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={7} className="ent-empty">No users match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <UserDrawer user={selected} onClose={() => setSelected(null)} onSaved={load} />
      )}
    </div>
  );
}
