import React, { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, ComposedChart, Line,
} from 'recharts';
import './DashboardCharts.css';

const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

function FancyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip fancy">
      <strong>{label || payload[0]?.payload?.fullTitle || payload[0]?.name}</strong>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tooltip-row">
          <i style={{ background: p.color || p.fill }} />
          <span>{p.name}: <b>{p.value}{p.unit || (p.dataKey === 'progress' || p.dataKey === 'streak' ? '' : '')}{['progress'].includes(p.dataKey) ? '%' : ''}</b></span>
        </div>
      ))}
    </div>
  );
}

function ChartShell({ title, subtitle, children, wide }) {
  return (
    <div className={`chart-card featured ${wide ? 'chart-card--wide' : ''}`}>
      <div className="chart-card-head">
        <div>
          <h3 className="chart-title">{title}</h3>
          {subtitle && <p className="chart-sub">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function DashboardCharts({ stats }) {
  if (!stats) return null;

  const { bookProgress = [], goalProgress = [], habitStats = [], booksByStatus = {}, goalsByStatus = {} } = stats;

  const bookArea = useMemo(() => bookProgress
    .filter((b) => b.totalPages > 0)
    .slice(0, 8)
    .map((b) => ({
      title: b.title.length > 12 ? `${b.title.slice(0, 12)}…` : b.title,
      fullTitle: b.title,
      progress: b.progress,
      pages: b.currentPage || 0,
    })), [bookProgress]);

  const bookPie = useMemo(() => Object.entries(booksByStatus)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.replace(/-/g, ' '), value })), [booksByStatus]);

  const goalPie = useMemo(() => Object.entries(goalsByStatus)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.replace(/-/g, ' '), value })), [goalsByStatus]);

  const goalBars = useMemo(() => goalProgress
    .filter((g) => g.status !== 'abandoned')
    .slice(0, 7)
    .map((g) => ({
      title: g.title.length > 14 ? `${g.title.slice(0, 14)}…` : g.title,
      fullTitle: g.title,
      progress: g.progress,
    })), [goalProgress]);

  const habitMix = useMemo(() => habitStats
    .slice()
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 6)
    .map((h) => ({
      name: h.name.length > 10 ? `${h.name.slice(0, 10)}…` : h.name,
      streak: h.streak,
      completed: h.completedCount,
    })), [habitStats]);

  const radar = useMemo(() => {
    const avgBook = bookProgress.length
      ? Math.round(bookProgress.reduce((s, b) => s + (b.progress || 0), 0) / bookProgress.length)
      : 0;
    const avgGoal = goalProgress.length
      ? Math.round(goalProgress.reduce((s, g) => s + (g.progress || 0), 0) / goalProgress.length)
      : 0;
    const topStreak = habitStats.reduce((m, h) => Math.max(m, h.streak || 0), 0);
    return [
      { metric: 'Reading', score: avgBook },
      { metric: 'Goals', score: avgGoal },
      { metric: 'Streaks', score: Math.min(100, topStreak * 10) },
      { metric: 'Focus', score: Math.min(100, (habitStats.length || 0) * 12) },
      { metric: 'Library', score: Math.min(100, bookProgress.length * 8) },
    ];
  }, [bookProgress, goalProgress, habitStats]);

  const hasAny = bookArea.length || bookPie.length || goalPie.length || goalBars.length || habitMix.length;

  if (!hasAny) {
    return (
      <div className="chart-card featured empty-charts">
        <h3 className="chart-title">Your signal board</h3>
        <p className="chart-sub">Add books, goals, or habits — live analytics appear here.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-charts featured-grid">
      {bookArea.length > 0 && (
        <ChartShell title="Reading momentum" subtitle="Progress across your library" wide>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={bookArea} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="readFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="title" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<FancyTooltip />} />
              <Area type="monotone" dataKey="progress" name="Progress" stroke="var(--chart-1)" fill="url(#readFill)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>
      )}

      <div className="chart-row">
        {bookPie.length > 0 && (
          <ChartShell title="Library mix" subtitle="Books by status">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={bookPie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} stroke="none">
                  {bookPie.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartShell>
        )}
        {goalPie.length > 0 && (
          <ChartShell title="Goal orbits" subtitle="Status distribution">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={goalPie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} stroke="none">
                  {goalPie.map((_, i) => <Cell key={i} fill={PALETTE[(i + 2) % PALETTE.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartShell>
        )}
      </div>

      {goalBars.length > 0 && (
        <ChartShell title="Goal success lanes" subtitle="Completion toward each north star" wide>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={goalBars} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} />
              <YAxis type="category" dataKey="title" width={90} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<FancyTooltip />} />
              <Bar dataKey="progress" name="Progress" fill="var(--chart-2)" radius={[0, 8, 8, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      )}

      <div className="chart-row">
        {habitMix.length > 0 && (
          <ChartShell title="Habit engine" subtitle="Streak vs total completions" wide>
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={habitMix} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<FancyTooltip />} />
                <Bar dataKey="completed" name="Total done" fill="var(--chart-2)" radius={[6, 6, 0, 0]} barSize={18} />
                <Line type="monotone" dataKey="streak" name="Streak" stroke="var(--chart-3)" strokeWidth={3} dot={{ r: 4 }} />
                <Legend />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartShell>
        )}

        <ChartShell title="Life radar" subtitle="Composite signal across modules">
          <ResponsiveContainer width="100%" height={230}>
            <RadarChart data={radar}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <Radar dataKey="score" name="Score" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.35} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>
    </div>
  );
}
