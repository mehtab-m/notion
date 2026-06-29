import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar,
} from 'recharts';
import './DashboardCharts.css';

const STATUS_COLORS = {
  reading: '#6366f1',
  completed: '#3b82f6',
  'want-to-read': '#6b7280',
  paused: '#f59e0b',
};

const GOAL_COLORS = {
  'in-progress': '#6366f1',
  completed: '#10b981',
  'not-started': '#6b7280',
  abandoned: '#ef4444',
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label || payload[0]?.payload?.title || payload[0]?.name}</strong>
      <span>{payload[0]?.value}{payload[0]?.unit || '%'}</span>
    </div>
  );
}

export default function DashboardCharts({ stats }) {
  if (!stats) return null;

  const { bookProgress, goalProgress, habitStats, booksByStatus, goalsByStatus } = stats;

  const bookBarData = bookProgress
    .filter((b) => b.totalPages > 0)
    .map((b) => ({
      title: b.title.length > 14 ? b.title.slice(0, 14) + '…' : b.title,
      progress: b.progress,
      fullTitle: b.title,
    }));

  const bookPieData = Object.entries(booksByStatus)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.replace('-', ' '), value }));

  const goalPieData = Object.entries(goalsByStatus)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.replace('-', ' '), value }));

  const goalBarData = goalProgress
    .filter((g) => g.status !== 'abandoned')
    .slice(0, 8)
    .map((g) => ({
      title: g.title.length > 12 ? g.title.slice(0, 12) + '…' : g.title,
      progress: g.progress,
    }));

  const habitBarData = habitStats
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 6)
    .map((h) => ({
      name: h.name.length > 10 ? h.name.slice(0, 10) + '…' : h.name,
      streak: h.streak,
      completed: h.completedCount,
    }));

  const radialData = bookProgress
    .filter((b) => b.totalPages > 0 && b.status !== 'want-to-read')
    .slice(0, 5)
    .map((b, i) => ({
      name: b.title.length > 10 ? b.title.slice(0, 10) + '…' : b.title,
      progress: b.progress,
      fill: Object.values(STATUS_COLORS)[i % 4],
    }));

  return (
    <div className="dashboard-charts">
      {bookBarData.length > 0 && (
        <div className="chart-card">
          <h3 className="chart-title">Reading Progress — All Books</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bookBarData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <XAxis dataKey="title" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="%" />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="progress" fill="var(--accent-green)" radius={[4, 4, 0, 0]} name="Progress" unit="%" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="chart-row">
        {bookPieData.length > 0 && (
          <div className="chart-card chart-card--half">
            <h3 className="chart-title">Books by Status</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={bookPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {bookPieData.map((_, i) => (
                    <Cell key={i} fill={Object.values(STATUS_COLORS)[i % 4]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {goalPieData.length > 0 && (
          <div className="chart-card chart-card--half">
            <h3 className="chart-title">Goals Overview</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={goalPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                  {goalPieData.map((entry, i) => (
                    <Cell key={i} fill={GOAL_COLORS[entry.name.replace(' ', '-')] || '#6366f1'} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {goalBarData.length > 0 && (
        <div className="chart-card">
          <h3 className="chart-title">Goal Success Rate</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={goalBarData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis type="category" dataKey="title" width={80} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="progress" fill="var(--accent)" radius={[0, 4, 4, 0]} unit="%" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {habitBarData.length > 0 && (
        <div className="chart-card">
          <h3 className="chart-title">Habit Streaks</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={habitBarData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip />
              <Bar dataKey="streak" fill="var(--accent-yellow)" name="Streak" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" fill="var(--accent-blue)" name="Total Done" radius={[4, 4, 0, 0]} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {radialData.length > 0 && (
        <div className="chart-card">
          <h3 className="chart-title">Book Completion Rings</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={radialData} startAngle={180} endAngle={0}>
              <RadialBar dataKey="progress" cornerRadius={4} />
              <Legend />
              <Tooltip content={<ChartTooltip />} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
