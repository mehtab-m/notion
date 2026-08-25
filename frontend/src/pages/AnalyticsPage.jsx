import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  BarChart3, Flame, Target, Timer, BookOpen, TrendingUp, TrendingDown,
  Trophy, Download, Minus, Sparkles,
} from 'lucide-react';
import { getAnalytics, getWeeklySummary } from '../utils/api';
import EmptyState from '../components/EmptyState';
import './AnalyticsPage.css';

const RANGES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 180, label: '6 months' },
  { days: 365, label: 'A year' },
];

/** Five buckets, because a heatmap with more shades stops being readable. */
function heatLevel(ratio) {
  if (ratio <= 0) return 0;
  if (ratio < 30) return 1;
  if (ratio < 55) return 2;
  if (ratio < 80) return 3;
  return 4;
}

function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <strong>{label ? format(parseISO(label), 'd MMM yyyy') : ''}</strong>
      {payload.map((entry) => (
        <span key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {Math.round(entry.value)}{unit}
        </span>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, week] = await Promise.all([getAnalytics(days), getWeeklySummary()]);
      setData(overview);
      setWeekly(week);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load your insights');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  /* The heatmap is laid out as weeks-of-7, so it needs the leading days
     of the first partial week padded out or the rows misalign. */
  const heatWeeks = useMemo(() => {
    if (!data?.heatmap?.length) return [];
    const cells = [...data.heatmap];
    const firstDay = parseISO(cells[0].date).getDay();
    const pad = Array.from({ length: firstDay }, () => null);
    const all = [...pad, ...cells];
    const weeks = [];
    for (let i = 0; i < all.length; i += 7) weeks.push(all.slice(i, i + 7));
    return weeks;
  }, [data?.heatmap]);

  const focusSeries = useMemo(
    () => (data?.focusDaily || []).map((d) => ({ ...d, minutes: d.minutes })),
    [data?.focusDaily]
  );

  const hasData =
    data &&
    (data.summary.habits > 0 ||
      data.summary.goals > 0 ||
      data.summary.focusSessions > 0 ||
      data.summary.books > 0);

  if (loading) {
    return (
      <div className="analytics-page page-enter">
        <div className="stat-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="shimmer" style={{ height: 118, borderRadius: 'var(--radius)' }} />
          ))}
        </div>
        <div className="shimmer" style={{ height: 300, borderRadius: 'var(--radius)', marginTop: 16 }} />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="analytics-page page-enter">
        <header className="page-header">
          <div>
            <h1>Insights</h1>
            <p className="page-header-sub">Everything you track, measured.</p>
          </div>
        </header>
        <EmptyState
          icon={BarChart3}
          title="Not enough to chart yet"
          description="Insights build themselves from your habits, goals, focus sessions and reading. Track a few days and this page fills in."
          actionLabel="Go to My Day"
          actionTo="/today"
        />
      </div>
    );
  }

  const { summary, habitBreakdown, goalVelocity, moneyTrend, leaderboard } = data;

  return (
    <div className="analytics-page page-enter">
      <header className="page-header">
        <div>
          <h1>Insights</h1>
          <p className="page-header-sub">
            {format(parseISO(data.range.from), 'd MMM')} – {format(parseISO(data.range.to), 'd MMM yyyy')}
          </p>
        </div>
        <div className="page-header-actions">
          <div className="segmented">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                className={days === r.days ? 'active' : ''}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Link to="/settings#data" className="btn btn-secondary btn-sm">
            <Download size={14} /> Export
          </Link>
        </div>
      </header>

      {/* ── Weekly recap ─────────────────────────────────── */}
      {weekly && (
        <section className="weekly-card">
          <div className="weekly-head">
            <span className="weekly-badge"><Sparkles size={13} /> This week</span>
            <span className="text-muted">
              {format(parseISO(weekly.range.from), 'd MMM')} – {format(parseISO(weekly.range.to), 'd MMM')}
            </span>
          </div>

          <div className="weekly-stats">
            <div>
              <strong>{weekly.habitRate}%</strong>
              <span>habit rate</span>
              <em>{weekly.habitCompletions} of {weekly.habitPossible}</em>
            </div>
            <div>
              <strong>{weekly.focusMinutes}m</strong>
              <span>focused</span>
              <em className={weekly.focusDelta >= 0 ? 'up' : 'down'}>
                {weekly.focusDelta === 0 ? <Minus size={11} />
                  : weekly.focusDelta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {Math.abs(weekly.focusDelta)}m vs last week
              </em>
            </div>
            <div>
              <strong>{weekly.goalsTouched}</strong>
              <span>goals moved</span>
              <em>{weekly.goalsCompleted} completed</em>
            </div>
            <div>
              <strong>{weekly.inboxCleared}</strong>
              <span>inbox cleared</span>
              <em>{weekly.notesCreated} notes written</em>
            </div>
          </div>

          <div className="weekly-bars" role="img" aria-label="Habits completed each day this week">
            {weekly.daily.map((day) => {
              const max = Math.max(1, ...weekly.daily.map((d) => d.habits));
              return (
                <div key={day.date} className="weekly-bar">
                  <span
                    style={{ height: `${Math.max(6, (day.habits / max) * 100)}%` }}
                    title={`${day.habits} habits, ${day.focus} min focused`}
                  />
                  <em>{format(parseISO(day.date), 'EEEEE')}</em>
                </div>
              );
            })}
          </div>

          {weekly.topHabit?.count > 0 && (
            <p className="weekly-note">
              Most consistent: <strong>{weekly.topHabit.icon} {weekly.topHabit.name}</strong> —{' '}
              {weekly.topHabit.count} day{weekly.topHabit.count === 1 ? '' : 's'}.
            </p>
          )}
        </section>
      )}

      {/* ── Headline numbers ─────────────────────────────── */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Habit consistency</span>
            <span className="stat-card-icon"><Flame size={16} /></span>
          </div>
          <div className="stat-card-value">{summary.habitConsistency}%</div>
          <div className="stat-card-meta">{summary.habitCompletions} check-ins</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Longest streak</span>
            <span className="stat-card-icon"><Trophy size={16} /></span>
          </div>
          <div className="stat-card-value">{summary.longestStreak}</div>
          <div className="stat-card-meta">days unbroken</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Focused time</span>
            <span className="stat-card-icon"><Timer size={16} /></span>
          </div>
          <div className="stat-card-value">{Math.floor(summary.focusMinutes / 60)}h</div>
          <div className="stat-card-meta">{summary.focusSessions} sessions</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Goal progress</span>
            <span className="stat-card-icon"><Target size={16} /></span>
          </div>
          <div className="stat-card-value">{summary.avgGoalProgress}%</div>
          <div className="stat-card-meta">{summary.goalsCompleted} of {summary.goals} done</div>
        </div>
      </div>

      {/* ── Habit heatmap ────────────────────────────────── */}
      <section className="card card-pad analytics-block">
        <div className="section-head">
          <h2><Flame size={16} /> Habit calendar</h2>
          <span className="section-head-sub">Share of habits completed each day</span>
        </div>

        <div className="heatmap-scroll">
          <div className="heatmap">
            {heatWeeks.map((week, wi) => (
              <div key={wi} className="heatmap-week">
                {week.map((cell, di) => (
                  <span
                    key={cell?.date || `pad-${wi}-${di}`}
                    className={cell ? `heat lvl-${heatLevel(cell.ratio)}` : 'heat is-pad'}
                    title={
                      cell
                        ? `${format(parseISO(cell.date), 'd MMM yyyy')} — ${cell.done}/${cell.total}`
                        : undefined
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="heatmap-legend">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((lvl) => <i key={lvl} className={`heat lvl-${lvl}`} />)}
          <span>More</span>
        </div>
      </section>

      <div className="analytics-two">
        {/* ── Focus over time ────────────────────────────── */}
        <section className="card card-pad">
          <div className="section-head">
            <h2><Timer size={16} /> Focus minutes</h2>
          </div>
          <div style={{ height: 232 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={focusSeries} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickFormatter={(v) => format(parseISO(v), 'd MMM')}
                  minTickGap={36}
                  stroke="var(--border)"
                />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--border)" />
                <Tooltip content={<ChartTooltip unit=" min" />} />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  name="Focus"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#focusFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ── Money ──────────────────────────────────────── */}
        <section className="card card-pad">
          <div className="section-head">
            <h2>Money balance</h2>
            <span className="section-head-sub">what you are owed, over time</span>
          </div>
          {moneyTrend.every((d) => d.gave === 0 && d.received === 0) ? (
            <EmptyState
              icon={TrendingUp}
              title="No transactions yet"
              description="Log who owes what and the running balance charts itself."
              actionLabel="Open Money"
              actionTo="/money"
            />
          ) : (
            <div style={{ height: 232 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={moneyTrend} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickFormatter={(v) => format(parseISO(v), 'd MMM')}
                    minTickGap={36}
                    stroke="var(--border)"
                  />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} stroke="var(--border)" />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    name="Net"
                    stroke="var(--chart-4)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <div className="analytics-two">
        {/* ── Goal velocity ──────────────────────────────── */}
        <section className="card card-pad">
          <div className="section-head">
            <h2><Target size={16} /> Goal pace</h2>
            <span className="section-head-sub">progress vs time elapsed</span>
          </div>

          {goalVelocity.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No active goals"
              description="Set a goal with a target date and its pace shows up here."
              actionLabel="Add a goal"
              actionTo="/goals"
            />
          ) : (
            <ul className="velocity-list">
              {goalVelocity.slice(0, 8).map((goal) => (
                <li key={goal._id}>
                  <div className="row-between">
                    <span className="truncate">{goal.icon} {goal.title}</span>
                    {goal.delta == null ? (
                      <em className="velocity-tag neutral">no deadline</em>
                    ) : (
                      <em className={`velocity-tag ${goal.delta >= 0 ? 'ahead' : 'behind'}`}>
                        {goal.delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {Math.abs(goal.delta)}% {goal.delta >= 0 ? 'ahead' : 'behind'}
                      </em>
                    )}
                  </div>
                  <div className="velocity-track">
                    <div className="velocity-actual" style={{ width: `${goal.progress}%` }} />
                    {goal.expected != null && (
                      <div
                        className="velocity-expected"
                        style={{ left: `${goal.expected}%` }}
                        title={`Expected: ${goal.expected}%`}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Streak leaderboard ─────────────────────────── */}
        <section className="card card-pad">
          <div className="section-head">
            <h2><Trophy size={16} /> Streak leaderboard</h2>
          </div>

          {leaderboard.length === 0 ? (
            <EmptyState
              icon={Flame}
              title="No habits tracked"
              description="Every habit you add joins this ranking."
              actionLabel="Add a habit"
              actionTo="/habits"
            />
          ) : (
            <ol className="leaderboard">
              {leaderboard.map((habit, i) => (
                <li key={habit._id} className={i < 3 ? `rank-${i + 1}` : ''}>
                  <span className="leaderboard-rank">{i + 1}</span>
                  <span className="leaderboard-icon">{habit.icon || '✅'}</span>
                  <div className="grow">
                    <strong className="truncate">{habit.name}</strong>
                    <span>{habit.completions} check-ins · {habit.consistency}% consistent</span>
                  </div>
                  <span className="leaderboard-streak">
                    <Flame size={12} /> {habit.streak}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* ── Habit detail ─────────────────────────────────── */}
      {habitBreakdown.length > 0 && (
        <section className="card card-pad analytics-block">
          <div className="section-head">
            <h2>Consistency by habit</h2>
            <span className="section-head-sub">over the last {days} days</span>
          </div>
          <ul className="consistency-list">
            {habitBreakdown.map((habit) => (
              <li key={habit._id}>
                <span className="consistency-name truncate">
                  {habit.icon || '✅'} {habit.name}
                </span>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${habit.consistency}%` }} />
                </div>
                <span className="consistency-value tabular">{habit.consistency}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Reading ──────────────────────────────────────── */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Books finished</span>
            <span className="stat-card-icon"><BookOpen size={16} /></span>
          </div>
          <div className="stat-card-value">{summary.booksFinished}</div>
          <div className="stat-card-meta">{summary.books} in your library</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Pages read</span>
            <span className="stat-card-icon"><BookOpen size={16} /></span>
          </div>
          <div className="stat-card-value">{summary.pagesRead}</div>
          <div className="stat-card-meta">across every book</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Notes</span>
            <span className="stat-card-icon"><BarChart3 size={16} /></span>
          </div>
          <div className="stat-card-value">{summary.notes}</div>
          <div className="stat-card-meta">pages and notebooks</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="stat-card-label">Inbox handled</span>
            <span className="stat-card-icon"><Sparkles size={16} /></span>
          </div>
          <div className="stat-card-value">{summary.inboxDone}</div>
          <div className="stat-card-meta">{summary.inboxOpen} still open</div>
        </div>
      </div>
    </div>
  );
}
