import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Users, UserCheck, UserX, Code2, Activity, ShieldCheck, Crown, X, Scale, RefreshCw, Radio,
  Orbit, Layers, Signal, Database, Cpu, Search, LayoutGrid, List, TrendingDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { getAdminStats, updateAdminUser } from '../utils/api';
import {
  BubbleChart, DonutChart, Waterfall, VennDiagram, AreaTrend, TreemapChart, TapeDiagram,
} from '../components/Charts/ChartKit';
import './AdminDashboard.css';

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
    <div className="ent-drawer-overlay mc-drawer-overlay" onClick={onClose}>
      <aside className="ent-drawer mc-drawer" onClick={(e) => e.stopPropagation()}>
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

/* ─── Mission Control ──────────────────────────────────────
   The admin page as a dark ops console: radar sweep for live
   health, a user galaxy (bubble chart), funnel waterfall, Venn of
   segments, content treemap, and crew badges for every account. */

function Radar({ active, total }) {
  const pct = total ? Math.round((active / total) * 100) : 0;
  const r = 86;
  const c = 2 * Math.PI * r;
  return (
    <div className="mc-radar" role="img" aria-label={`${pct}% of users active`}>
      <svg viewBox="0 0 220 220">
        <defs>
          <radialGradient id="mcRadarBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.18 }} />
            <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
          </radialGradient>
          <linearGradient id="mcSweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
            <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.55 }} />
          </linearGradient>
        </defs>
        <circle cx="110" cy="110" r="104" fill="url(#mcRadarBg)" />
        {[30, 55, 80, 104].map((rr) => <circle key={rr} cx="110" cy="110" r={rr} className="mc-radar-ring" />)}
        <line x1="6" y1="110" x2="214" y2="110" className="mc-radar-ring" />
        <line x1="110" y1="6" x2="110" y2="214" className="mc-radar-ring" />
        <g className="mc-radar-sweep">
          <path d="M110 110 L214 110 A104 104 0 0 0 183.5 36.5 Z" fill="url(#mcSweep)" />
        </g>
        <circle cx="110" cy="110" r={r} className="mc-radar-track" />
        <circle
          cx="110" cy="110" r={r}
          className="mc-radar-value"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 110 110)"
        />
      </svg>
      <div className="mc-radar-copy">
        <strong>{pct}%</strong>
        <span>active</span>
      </div>
    </div>
  );
}

function Readout({ icon: Icon, label, value, sub, tone = 'cyan' }) {
  return (
    <div className={`mc-readout mc-${tone}`}>
      <div className="mc-readout-top">
        <Icon size={14} />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      {sub && <em>{sub}</em>}
    </div>
  );
}

function initials(name) {
  return (name || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function CrewBadge({ user, inactiveDays, onOpen }) {
  const total = Object.values(user.content || {}).reduce((s, n) => s + (n || 0), 0);
  const heat = Math.min(100, (user.weekActivityCount || 0) * 8);
  return (
    <button type="button" className={`mc-badge plan-${user.plan} ${user.isActive ? 'is-on' : 'is-off'}`} onClick={() => onOpen(user)}>
      <span className="mc-badge-glow" />
      <div className="mc-badge-top">
        <span className="mc-badge-avatar">{initials(user.name)}</span>
        <span className={`mc-led ${user.isActive ? 'on' : 'off'}`} title={reasonLabel(user.activeReason, inactiveDays)} />
      </div>
      <strong className="mc-badge-name">{user.name}</strong>
      <span className="mc-badge-mail">{user.email}</span>
      <div className="mc-badge-tags">
        <span className={`mc-tag plan-${user.plan}`}>{user.plan}</span>
        {user.role === 'admin' && <span className="mc-tag admin">admin</span>}
        {user.isDeveloper && <span className="mc-tag dev">dev</span>}
      </div>
      <div className="mc-badge-meter" title={`${user.weekActivityCount} events this week`}>
        <i style={{ width: `${heat}%` }} />
      </div>
      <div className="mc-badge-foot">
        <span>{user.weekActivityCount}<em>/wk</em></span>
        <span>{total}<em> items</em></span>
        <span>{user.loginCount || 0}<em> logins</em></span>
      </div>
    </button>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('badges');
  const [selected, setSelected] = useState(null);
  const [clock, setClock] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getAdminStats());
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load admin stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const derived = useMemo(() => {
    if (!data) return null;
    const { overview, users, contentTotals, signupsByDay } = data;
    const now = Date.now();
    const galaxy = users.map((u) => ({
      name: u.name,
      x: Math.max(0, Math.round((now - new Date(u.createdAt).getTime()) / 86400000)),
      y: u.weekActivityCount || 0,
      z: Math.max(1, Object.values(u.content || {}).reduce((s, n) => s + (n || 0), 0)),
      color: u.plan === 'platinum' ? 'var(--chart-5)' : u.plan === 'premium' ? 'var(--accent-yellow)' : u.isActive ? 'var(--accent)' : 'var(--text-muted)',
    }));
    const paid = (u) => u.plan === 'premium' || u.plan === 'platinum';
    const dev = users.filter((u) => u.isDeveloper === true);
    const act = users.filter((u) => u.isActive);
    const pay = users.filter(paid);
    const venn = {
      sets: [{ name: 'Active', size: act.length }, { name: 'Developers', size: dev.length }, { name: 'Paid', size: pay.length }],
      overlaps: {
        ab: users.filter((u) => u.isActive && u.isDeveloper === true).length,
        ac: users.filter((u) => u.isActive && paid(u)).length,
        bc: users.filter((u) => u.isDeveloper === true && paid(u)).length,
        abc: users.filter((u) => u.isActive && u.isDeveloper === true && paid(u)).length,
      },
    };
    const funnel = [
      { name: 'Signed up', value: overview.totalUsers },
      { name: 'Inactive', value: -overview.inactiveUsers },
      { name: 'Free', value: -(act.filter((u) => !paid(u)).length) },
    ];
    const plans = [
      { name: 'Common', value: overview.commonUsers || 0, color: 'var(--text-muted)' },
      { name: 'Premium', value: overview.premiumUsers || 0, color: 'var(--accent-yellow)' },
      { name: 'Platinum', value: overview.platinumUsers || 0, color: 'var(--chart-5)' },
    ].filter((p) => p.value > 0);
    const tree = Object.entries(contentTotals).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
    const signups = (signupsByDay || []).map((d) => ({ date: d.day, signups: d.count }));
    const tape = [
      { label: 'Developer choice', segments: [
        { name: 'developer', value: overview.developers, color: 'var(--accent)' },
        { name: 'non-dev', value: overview.nonDevelopers, color: 'var(--chart-2)' },
        { name: 'undecided', value: overview.undecidedDeveloper, color: 'var(--text-muted)' },
      ] },
      { label: 'Weekly events', segments: [
        { name: 'logins', value: overview.weeklyLogins || 0, color: 'var(--accent-green)' },
        { name: 'app uses', value: overview.weeklyAppUses || 0, color: 'var(--chart-5)' },
      ] },
    ];
    return { galaxy, venn, funnel, plans, tree, signups, tape };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="mc mc-loading">
        <div className="mc-boot"><Radio size={22} /> Establishing uplink…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <Users size={40} strokeWidth={1} />
        <h3>No admin data</h3>
      </div>
    );
  }

  const { overview, contentTotals, users, ethicalDataPolicy } = data;
  const inactiveDays = overview.inactiveAfterDays || 3;
  const q = query.trim().toLowerCase();
  const filteredUsers = users.filter((u) => {
    if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
    if (filter === 'active') return u.isActive;
    if (filter === 'inactive') return !u.isActive;
    if (filter === 'developers') return u.isDeveloper === true;
    if (filter === 'premium') return u.plan === 'premium' || u.plan === 'platinum';
    return true;
  });

  const ticker = [
    `USERS ${overview.totalUsers}`,
    `ACTIVE ${overview.activeUsers}`,
    `NEW/7D ${overview.newThisWeek}`,
    `NEW/30D ${overview.newThisMonth}`,
    `LOGINS/7D ${overview.weeklyLogins || 0}`,
    `EVENTS/7D ${overview.weeklyActivityEvents}`,
    ...Object.entries(contentTotals).map(([k, v]) => `${k.toUpperCase()} ${v}`),
  ];

  return (
    <div className="mc">
      <div className="mc-grid-bg" aria-hidden />

      <header className="mc-head">
        <div className="mc-head-left">
          <span className="mc-chip"><span className="mc-led on" /> SYSTEM NOMINAL</span>
          <h1>Mission <span>Control</span></h1>
          <p>SortLife operations console · inactive after {inactiveDays}d · {format(clock, 'EEE d MMM · HH:mm:ss')}</p>
        </div>
        <div className="mc-head-right">
          <Radar active={overview.activeUsers} total={overview.totalUsers} />
          <button type="button" className="mc-btn" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'mc-spin' : ''} /> {loading ? 'Syncing' : 'Resync'}
          </button>
        </div>
      </header>

      <div className="mc-ticker" aria-hidden>
        <div className="mc-ticker-track">
          {[...ticker, ...ticker].map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      <div className="mc-readouts">
        <Readout icon={Users} label="Total crew" value={overview.totalUsers} sub={`+${overview.newThisWeek} this week`} />
        <Readout icon={UserCheck} label="Active" value={overview.activeUsers} sub={`${overview.inGracePeriod} in grace`} tone="green" />
        <Readout icon={UserX} label="Dormant" value={overview.inactiveUsers} sub="follow-up emailed" tone="red" />
        <Readout icon={Crown} label="Paid" value={(overview.premiumUsers || 0) + (overview.platinumUsers || 0)} sub={`${overview.premiumUsers || 0} premium · ${overview.platinumUsers || 0} platinum`} tone="gold" />
        <Readout icon={Code2} label="Developers" value={overview.developers} sub={`${overview.undecidedDeveloper} undecided`} tone="violet" />
        <Readout icon={Activity} label="Events / 7d" value={overview.weeklyActivityEvents} sub={`${overview.weeklyLogins || 0} logins`} tone="pink" />
      </div>

      <div className="mc-panels">
        <section className="mc-panel mc-panel--wide">
          <header><Orbit size={14} /> User galaxy <em>x: days since join · y: events this week · size: content</em></header>
          <BubbleChart data={derived.galaxy} height={280} xLabel="Days since signup" yLabel="Events / week" zLabel="Items" zRange={[40, 700]} />
        </section>
        <section className="mc-panel">
          <header><Crown size={14} /> Plan mix</header>
          <DonutChart data={derived.plans} height={250} centerLabel="users" />
        </section>
      </div>

      <div className="mc-panels mc-panels--3">
        <section className="mc-panel">
          <header><TrendingDown size={14} /> Conversion waterfall</header>
          <Waterfall data={derived.funnel} height={240} />
        </section>
        <section className="mc-panel">
          <header><Layers size={14} /> Segment overlap</header>
          <VennDiagram sets={derived.venn.sets} overlaps={derived.venn.overlaps} height={240} />
        </section>
        <section className="mc-panel">
          <header><Signal size={14} /> Signups · 30d</header>
          {derived.signups.length ? (
            <AreaTrend data={derived.signups} series={[{ key: 'signups', name: 'Signups', color: 'var(--accent)' }]} height={240}
              xFormatter={(v) => { try { return format(parseISO(v), 'd MMM'); } catch { return v; } }} />
          ) : <div className="kit-empty">No signups in this window.</div>}
        </section>
      </div>

      <div className="mc-panels">
        <section className="mc-panel mc-panel--wide">
          <header><Database size={14} /> Content mass</header>
          <TreemapChart data={derived.tree} height={220} />
        </section>
        <section className="mc-panel">
          <header><Cpu size={14} /> Telemetry tapes</header>
          <TapeDiagram rows={derived.tape} />
        </section>
      </div>

      {ethicalDataPolicy && (
        <div className="mc-policy">
          <ShieldCheck size={16} />
          <div>
            <strong>Data &amp; ethics protocol</strong>
            <p>{ethicalDataPolicy.activeRule}</p>
            <p className="mc-dim">Collected: {(ethicalDataPolicy.collected || []).join(' · ')} — never: {(ethicalDataPolicy.notCollected || []).join(' · ')}</p>
          </div>
        </div>
      )}

      <div className="mc-crew-head">
        <h2><Users size={16} /> Crew manifest <em>{filteredUsers.length}</em></h2>
        <div className="mc-crew-tools">
          <div className="mc-search">
            <Search size={13} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search name or email" />
          </div>
          <div className="mc-seg">
            {[['all', 'All'], ['active', 'Active'], ['inactive', 'Dormant'], ['premium', 'Paid'], ['developers', 'Devs']].map(([key, label]) => (
              <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
          <div className="mc-seg">
            <button type="button" className={view === 'badges' ? 'active' : ''} onClick={() => setView('badges')} aria-label="Badge view"><LayoutGrid size={13} /></button>
            <button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')} aria-label="Table view"><List size={13} /></button>
          </div>
        </div>
      </div>

      {view === 'badges' ? (
        <div className="mc-crew">
          {filteredUsers.map((u) => <CrewBadge key={u._id} user={u} inactiveDays={inactiveDays} onOpen={setSelected} />)}
          {filteredUsers.length === 0 && <p className="mc-dim">No crew match this filter.</p>}
        </div>
      ) : (
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead>
              <tr><th>User</th><th>Status</th><th>Plan</th><th>Activity</th><th>Content</th><th>Legal</th><th /></tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u._id}>
                  <td><strong>{u.name}</strong><span className="mc-dim block">{u.email}</span></td>
                  <td><span className={`mc-led ${u.isActive ? 'on' : 'off'}`} /> {reasonLabel(u.activeReason, inactiveDays)}</td>
                  <td><span className={`mc-tag plan-${u.plan}`}>{u.plan}</span></td>
                  <td><strong>{u.weekActivityCount}</strong>/wk<span className="mc-dim block">{u.weekLogins || 0}L · {u.weekAppUses || 0}U</span></td>
                  <td className="mc-mono">B{u.content.books} S{u.content.shows} H{u.content.habits} G{u.content.goals} N{u.content.notes}</td>
                  <td>{u.legalSettings?.termsAccepted ? 'Terms ✓' : 'Terms —'}<span className="mc-dim block">{u.legalSettings?.marketingEmails ? 'Mkt' : 'No mkt'}</span></td>
                  <td><button type="button" className="mc-btn mc-btn--sm" onClick={() => setSelected(u)}>Manage</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <UserDrawer user={selected} onClose={() => setSelected(null)} onSaved={load} />}
    </div>
  );
}
