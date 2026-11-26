import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import {
  BarChart3, Flame, Target, Timer, BookOpen, TrendingUp, TrendingDown,
  Trophy, Download, Minus, Sparkles, Footprints, Wallet, Layers, Tags,
  Orbit, Clock, Activity, PieChart as PieIcon,
} from 'lucide-react';
import { getAnalytics, getWeeklySummary } from '../utils/api';
import EmptyState from '../components/EmptyState';
import {
  ChartCard, ChartGrid, DonutChart, ConcentricRings, BubbleRace, AreaTrend,
  ScatterPlot, Waterfall, TapeDiagram, VennDiagram, RadarWeb, TreemapChart, Gauge,
} from '../components/Charts/ChartKit';
import './AnalyticsPage.css';

const RANGES = [
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 180, label: '6m' },
  { days: 365, label: '1y' },
];

const pretty = (s) => String(s).replace(/-/g, ' ');
const slices = (obj) => Object.entries(obj || {})
  .filter(([, v]) => v > 0)
  .sort((a, b) => b[1] - a[1])
  .map(([name, value]) => ({ name: pretty(name), value }));
const dayFmt = (v) => (v ? format(parseISO(v), 'd MMM') : '');

/** Five buckets, because a heatmap with more shades stops being readable. */
function heatLevel(ratio) {
  if (ratio <= 0) return 0;
  if (ratio < 30) return 1;
  if (ratio < 55) return 2;
  if (ratio < 80) return 3;
  return 4;
}

function Kpi({ icon: Icon, label, value, meta, tone = 'accent' }) {
  return (
    <div className={`ins-kpi ins-kpi--${tone}`}>
      <span className="ins-kpi-icon"><Icon size={16} /></span>
      <div>
        <span className="ins-kpi-label">{label}</span>
        <strong className="ins-kpi-value">{value}</strong>
        {meta && <span className="ins-kpi-meta">{meta}</span>}
      </div>
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

  const heatWeeks = useMemo(() => {
    if (!data?.heatmap?.length) return [];
    const cells = [...data.heatmap];
    const firstDay = parseISO(cells[0].date).getDay();
    const all = [...Array.from({ length: firstDay }, () => null), ...cells];
    const weeks = [];
    for (let i = 0; i < all.length; i += 7) weeks.push(all.slice(i, i + 7));
    return weeks;
  }, [data?.heatmap]);

  /* Weekly net money flow → waterfall steps. */
  const moneySteps = useMemo(() => {
    const trend = data?.moneyTrend || [];
    const steps = [];
    for (let i = 0; i < trend.length; i += 7) {
      const chunk = trend.slice(i, i + 7);
      const net = chunk.reduce((s, d) => s + d.net, 0);
      if (net !== 0) steps.push({ name: dayFmt(chunk[0].date), value: Math.round(net * 100) / 100 });
    }
    return steps.slice(-10);
  }, [data?.moneyTrend]);

  const raceFrames = useMemo(
    () => (data?.habitRace || []).map((f) => ({ ...f, label: dayFmt(f.label) })),
    [data?.habitRace]
  );

  const goalRings = useMemo(() => (data?.goalVelocity || []).slice(0, 6).map((g) => ({
    name: g.title.length > 16 ? `${g.title.slice(0, 16)}…` : g.title,
    value: g.progress || 0,
  })), [data?.goalVelocity]);

  const radar = useMemo(() => {
    if (!data) return [];
    const s = data.summary;
    return [
      { metric: 'Habits', score: s.habitConsistency },
      { metric: 'Goals', score: s.avgGoalProgress },
      { metric: 'Focus', score: Math.min(100, Math.round(s.focusMinutes / (data.range.days * 0.6))) },
      { metric: 'Running', score: Math.min(100, Math.round((data.runs?.minutes || 0) / (data.range.days * 0.2))) },
      { metric: 'Reading', score: Math.min(100, Math.round(s.pagesRead / 20)) },
      { metric: 'Inbox', score: s.inboxDone + s.inboxOpen ? Math.round((s.inboxDone / (s.inboxDone + s.inboxOpen)) * 100) : 0 },
    ];
  }, [data]);

  const hasData = data && (data.summary.habits > 0 || data.summary.goals > 0
    || data.summary.focusSessions > 0 || data.summary.books > 0 || (data.runs?.count || 0) > 0);

  if (loading) {
    return (
      <div className="analytics-page page-enter">
        <div className="shimmer" style={{ height: 180, borderRadius: 24, marginBottom: 16 }} />
        <div className="ins-kpis">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="shimmer" style={{ height: 92, borderRadius: 16 }} />
          ))}
        </div>
        <div className="shimmer" style={{ height: 300, borderRadius: 18, marginTop: 16 }} />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="analytics-page page-enter">
        <EmptyState
          icon={BarChart3}
          title="Not enough to chart yet"
          description="Insights build themselves from your habits, goals, focus sessions, runs and reading. Track a few days and this page fills in."
          actionLabel="Go to My Day"
          actionTo="/today"
        />
      </div>
    );
  }

  const { summary, habitBreakdown, leaderboard, breakdowns = {}, venn, focusScatter = [], runs = {} } = data;
  const noteTags = slices(breakdowns.noteTags).slice(0, 14);
  const hasMoney = moneySteps.length > 0;
  const hasFocusOrRun = (data.focusDaily || []).some((d) => d.minutes || d.run);

  return (
    <div className="analytics-page page-enter">
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="ins-hero">
        <div className="ins-hero-copy">
          <span className="ins-eyebrow"><Sparkles size={13} /> Insights</span>
          <h1>Your life, in numbers</h1>
          <p>
            {format(parseISO(data.range.from), 'd MMM')} – {format(parseISO(data.range.to), 'd MMM yyyy')}
            {' · '}{summary.habitCompletions} check-ins · {Math.round(summary.focusMinutes / 60)}h focused · {runs.count || 0} runs
          </p>
          <div className="ins-hero-actions">
            <div className="ins-range">
              {RANGES.map((r) => (
                <button key={r.days} type="button" className={days === r.days ? 'active' : ''} onClick={() => setDays(r.days)}>
                  {r.label}
                </button>
              ))}
            </div>
            <Link to="/settings#data" className="ins-ghost-btn"><Download size={14} /> Export</Link>
          </div>
        </div>
        <div className="ins-hero-gauges">
          <Gauge value={summary.habitConsistency} label="habit consistency" height={140} color="var(--chart-1)" />
          <Gauge value={summary.avgGoalProgress} label="goal progress" height={140} color="var(--chart-4)" />
        </div>
      </section>

      {/* ── KPIs ───────────────────────────────────────────── */}
      <div className="ins-kpis">
        <Kpi icon={Trophy} label="Longest streak" value={summary.longestStreak} meta="days unbroken" tone="amber" />
        <Kpi icon={Timer} label="Focused" value={`${Math.floor(summary.focusMinutes / 60)}h ${summary.focusMinutes % 60}m`} meta={`${summary.focusSessions} sessions`} />
        <Kpi icon={Footprints} label="Running" value={`${runs.minutes || 0}m`} meta={`${runs.count || 0} runs`} tone="green" />
        <Kpi icon={BookOpen} label="Pages read" value={summary.pagesRead} meta={`${summary.booksFinished} books finished`} tone="pink" />
      </div>

      {/* ── Weekly recap ──────────────────────────────────── */}
      {weekly && (
        <section className="weekly-card">
          <div className="weekly-head">
            <span className="weekly-badge"><Sparkles size={13} /> This week</span>
            <span className="text-muted">
              {format(parseISO(weekly.range.from), 'd MMM')} – {format(parseISO(weekly.range.to), 'd MMM')}
            </span>
          </div>
          <div className="weekly-stats">
            <div><strong>{weekly.habitRate}%</strong><span>habit rate</span><em>{weekly.habitCompletions} of {weekly.habitPossible}</em></div>
            <div>
              <strong>{weekly.focusMinutes}m</strong><span>focused</span>
              <em className={weekly.focusDelta >= 0 ? 'up' : 'down'}>
                {weekly.focusDelta === 0 ? <Minus size={11} /> : weekly.focusDelta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {Math.abs(weekly.focusDelta)}m vs last week
              </em>
            </div>
            <div><strong>{weekly.goalsTouched}</strong><span>goals moved</span><em>{weekly.goalsCompleted} completed</em></div>
            <div><strong>{weekly.inboxCleared}</strong><span>inbox cleared</span><em>{weekly.notesCreated} notes written</em></div>
          </div>
          <div className="weekly-bars" role="img" aria-label="Habits completed each day this week">
            {weekly.daily.map((day) => {
              const max = Math.max(1, ...weekly.daily.map((d) => d.habits));
              return (
                <div key={day.date} className="weekly-bar">
                  <span style={{ height: `${Math.max(6, (day.habits / max) * 100)}%` }} title={`${day.habits} habits, ${day.focus} min focused`} />
                  <em>{format(parseISO(day.date), 'EEEEE')}</em>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Habits ─────────────────────────────────────────── */}
      <h2 className="ins-section-title"><Flame size={16} /> Habits</h2>
      <ChartGrid cols={2}>
        <ChartCard title="Habit race" subtitle="Weekly replay — x: total check-ins, y: days active that week" icon={Activity} empty={!raceFrames.length || !raceFrames[0].points.length} emptyText="Add habits and the race starts.">
          <BubbleRace frames={raceFrames} xLabel="Total check-ins" yLabel="Days this week" zLabel="Check-ins" />
        </ChartCard>
        <ChartCard title="Habit calendar" subtitle="Share of habits completed each day" icon={Flame}>
          <div className="heatmap-scroll">
            <div className="heatmap">
              {heatWeeks.map((week, wi) => (
                <div key={wi} className="heatmap-week">
                  {week.map((cell, di) => (
                    <span
                      key={cell?.date || `pad-${wi}-${di}`}
                      className={cell ? `heat lvl-${heatLevel(cell.ratio)}` : 'heat is-pad'}
                      title={cell ? `${format(parseISO(cell.date), 'd MMM yyyy')} — ${cell.done}/${cell.total}` : undefined}
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
          {leaderboard.length > 0 && (
            <ol className="leaderboard ins-leaderboard">
              {leaderboard.slice(0, 5).map((habit, i) => (
                <li key={habit._id} className={i < 3 ? `rank-${i + 1}` : ''}>
                  <span className="leaderboard-rank">{i + 1}</span>
                  <span className="leaderboard-icon">{habit.icon || '✅'}</span>
                  <div className="grow">
                    <strong className="truncate">{habit.name}</strong>
                    <span>{habit.completions} check-ins · {habit.consistency}% consistent</span>
                  </div>
                  <span className="leaderboard-streak"><Flame size={12} /> {habit.streak}</span>
                </li>
              ))}
            </ol>
          )}
        </ChartCard>
      </ChartGrid>

      {/* ── Time ───────────────────────────────────────────── */}
      <h2 className="ins-section-title"><Clock size={16} /> Time</h2>
      <ChartGrid cols={1}>
        <ChartCard title="Focus & running" subtitle="Stacked minutes per day" icon={Timer} empty={!hasFocusOrRun} emptyText="Start a focus block or a run to fill this.">
          <AreaTrend
            data={data.focusDaily}
            series={[{ key: 'minutes', name: 'Focus' }, { key: 'run', name: 'Running', color: 'var(--chart-4)' }]}
            stacked
            unit=" min"
            xFormatter={dayFmt}
            height={260}
          />
        </ChartCard>
      </ChartGrid>
      <ChartGrid cols={2}>
        <ChartCard title="When you focus" subtitle="Scatter — hour of day vs session length" icon={Clock} empty={!focusScatter.length} emptyText="No focus sessions in this range.">
          <ScatterPlot
            data={focusScatter.map((p) => ({ ...p, x: Math.round(p.x * 10) / 10 }))}
            xLabel="Hour of day"
            yLabel="Minutes"
            xDomain={[0, 24]}
            xTicks={[0, 4, 8, 12, 16, 20, 24]}
            xFormatter={(h) => `${h}:00`}
          />
        </ChartCard>
        <ChartCard title="Overlap" subtitle="Venn — days with habits, focus and notes" icon={Orbit}>
          {venn && <VennDiagram sets={venn.sets} overlaps={venn.overlaps} />}
        </ChartCard>
      </ChartGrid>

      {/* ── Goals ──────────────────────────────────────────── */}
      <h2 className="ins-section-title"><Target size={16} /> Goals</h2>
      <ChartGrid cols={3}>
        <ChartCard title="Goal rings" subtitle="Concentric progress, one ring per goal" icon={Target} empty={!goalRings.length} emptyText="No active goals.">
          <ConcentricRings data={goalRings} />
        </ChartCard>
        <ChartCard title="By category" subtitle="Where your ambition goes" icon={PieIcon} empty={!slices(breakdowns.goalsByCategory).length}>
          <DonutChart data={slices(breakdowns.goalsByCategory)} centerLabel="goals" />
        </ChartCard>
        <ChartCard title="Life radar" subtitle="Composite signal" icon={Activity}>
          <RadarWeb data={radar} />
        </ChartCard>
      </ChartGrid>

      {/* ── Pipelines & money ─────────────────────────────── */}
      <h2 className="ins-section-title"><Layers size={16} /> Pipelines</h2>
      <ChartGrid cols={2}>
        <ChartCard title="Status tapes" subtitle="Every list, split by status" icon={Layers}>
          <TapeDiagram rows={[
            { label: 'Goals', segments: slices(breakdowns.goalsByStatus) },
            { label: 'Goal horizon', segments: slices(breakdowns.goalsByHorizon) },
            { label: 'Books', segments: slices(breakdowns.booksByStatus) },
            { label: 'Shows', segments: slices(breakdowns.showsByStatus) },
            { label: 'Inbox', segments: slices(breakdowns.inboxByStatus) },
          ]} />
        </ChartCard>
        <ChartCard title="Money waterfall" subtitle="Weekly net — what you gave minus what came back" icon={Wallet} empty={!hasMoney} emptyText="Log a transaction in Money to see the waterfall.">
          <Waterfall data={moneySteps} />
        </ChartCard>
      </ChartGrid>

      <ChartGrid cols={2}>
        <ChartCard title="Library" subtitle="Books by status" icon={BookOpen} empty={!slices(breakdowns.booksByStatus).length}>
          <DonutChart data={slices(breakdowns.booksByStatus)} full />
        </ChartCard>
        <ChartCard title="Note topics" subtitle="Treemap of tags across your notebook" icon={Tags} empty={!noteTags.length} emptyText="Tag a note to see your topics.">
          <TreemapChart data={noteTags} />
        </ChartCard>
      </ChartGrid>

      {habitBreakdown.length > 0 && (
        <ChartCard title="Consistency by habit" subtitle={`over the last ${days} days`} icon={Flame} wide>
          <ul className="consistency-list">
            {habitBreakdown.map((habit) => (
              <li key={habit._id}>
                <span className="consistency-name truncate">{habit.icon || '✅'} {habit.name}</span>
                <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${habit.consistency}%` }} /></div>
                <span className="consistency-value tabular">{habit.consistency}%</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}
    </div>
  );
}
