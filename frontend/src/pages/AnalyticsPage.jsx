import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format, parseISO, isToday } from 'date-fns';
import {
  BarChart3, Flame, Target, Timer, BookOpen, TrendingUp, TrendingDown,
  Trophy, Download, Minus, Sparkles, Footprints, CalendarDays, Check,
} from 'lucide-react';
import { getAnalytics, getWeeklySummary } from '../utils/api';
import EmptyState from '../components/EmptyState';
import '../components/Dashboard/DashboardCharts.css';
import './AnalyticsPage.css';

/*
 * Insights, written for people rather than analysts: every block is a
 * sentence, a big number or a progress bar. No scatter plots, radars,
 * Venn diagrams or treemaps.
 */

const RANGES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
];

const pct = (n) => Math.max(0, Math.min(100, Math.round(n || 0)));
const safeDate = (v, f) => { try { return format(parseISO(v), f); } catch { return ''; } };

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

function Widget({ icon: Icon, title, hint, tone = 'var(--accent)', children, className = '' }) {
  return (
    <section className={`dw ${className}`} style={{ '--tone': tone }}>
      <header className="dw-head">
        <span className="dw-icon"><Icon size={16} /></span>
        <div>
          <h3>{title}</h3>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function BarRow({ label, value, right, color }) {
  return (
    <div className="dw-row">
      <div className="dw-row-top">
        <span className="dw-row-label">{label}</span>
        <span className="dw-row-right">{right ?? `${pct(value)}%`}</span>
      </div>
      <div className="dw-bar"><span style={{ width: `${pct(value)}%`, background: color }} /></div>
    </div>
  );
}

/** A month-style calendar: each day shows its date and how much got done. */
function HabitCalendar({ cells }) {
  const weeks = useMemo(() => {
    const recent = cells.slice(-35);
    if (!recent.length) return [];
    const first = parseISO(recent[0].date).getDay(); // 0 = Sunday
    const all = [...Array.from({ length: first }, () => null), ...recent];
    while (all.length % 7) all.push(null);
    const out = [];
    for (let i = 0; i < all.length; i += 7) out.push(all.slice(i, i + 7));
    return out;
  }, [cells]);

  return (
    <div className="hcal">
      <div className="hcal-row hcal-head">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <span key={d}>{d}</span>)}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="hcal-row">
          {week.map((c, di) => {
            if (!c) return <span key={`p${wi}-${di}`} className="hcal-cell is-pad" />;
            const ratio = c.total ? c.done / c.total : 0;
            const state = !c.total ? 'none' : ratio >= 1 ? 'all' : ratio > 0 ? 'some' : 'missed';
            const d = parseISO(c.date);
            return (
              <span
                key={c.date}
                className={`hcal-cell is-${state} ${isToday(d) ? 'is-today' : ''}`}
                title={`${format(d, 'EEEE d MMM')} — ${c.done} of ${c.total} habits done`}
                style={{ '--fill': `${Math.round(ratio * 100)}%` }}
              >
                <em>{format(d, 'd')}</em>
                {state === 'all' && <Check size={12} strokeWidth={3} />}
                {state === 'some' && <small>{c.done}/{c.total}</small>}
              </span>
            );
          })}
        </div>
      ))}
      <div className="hcal-legend">
        <span><i className="is-all" /> All done</span>
        <span><i className="is-some" /> Some done</span>
        <span><i className="is-missed" /> Missed</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
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

  /* Focus minutes grouped by week so even a year fits in a handful of bars. */
  const focusWeeks = useMemo(() => {
    const rows = data?.focusDaily || [];
    const out = [];
    for (let i = 0; i < rows.length; i += 7) {
      const chunk = rows.slice(i, i + 7);
      out.push({
        label: safeDate(chunk[0].date, 'd MMM'),
        minutes: chunk.reduce((s, d) => s + (d.minutes || 0) + (d.run || 0), 0),
      });
    }
    return out.slice(-12);
  }, [data?.focusDaily]);

  const hasData = data && (data.summary.habits > 0 || data.summary.goals > 0
    || data.summary.focusSessions > 0 || data.summary.books > 0 || (data.runs?.count || 0) > 0);

  if (loading) {
    return (
      <div className="analytics-page page-enter">
        <div className="shimmer" style={{ height: 160, borderRadius: 20, marginBottom: 16 }} />
        <div className="ins-kpis">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="shimmer" style={{ height: 92, borderRadius: 16 }} />)}
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="analytics-page page-enter">
        <EmptyState
          icon={BarChart3}
          title="Nothing to show yet"
          description="This page fills itself in as you check off habits, work on goals, focus and read. Come back after a few days."
          actionLabel="Go to My Day"
          actionTo="/today"
        />
      </div>
    );
  }

  const { summary, habitBreakdown = [], leaderboard = [], runs = {} } = data;
  const goals = (data.goalVelocity || []).slice(0, 6);
  const maxWeek = Math.max(1, ...focusWeeks.map((w) => w.minutes));
  const totalFocus = summary.focusMinutes + (runs.minutes || 0);
  const streakById = Object.fromEntries(leaderboard.map((h) => [h._id, h.streak]));
  const rangeLabel = RANGES.find((r) => r.days === days)?.label.toLowerCase() || `${days} days`;

  /* One-sentence verdict for the week. */
  const weekVerdict = weekly
    ? weekly.habitRate >= 80 ? 'Great week — you kept almost all your habits.'
      : weekly.habitRate >= 50 ? 'Solid week — more than half your habits done.'
        : weekly.habitPossible ? 'A slower week. One habit today gets you back on track.'
          : 'Add a habit to start tracking your week.'
    : '';

  return (
    <div className="analytics-page page-enter">
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="ins-hero">
        <div className="ins-hero-copy">
          <span className="ins-eyebrow"><Sparkles size={13} /> Insights</span>
          <h1>How you're doing</h1>
          <p>
            In the last {rangeLabel} you checked off <strong>{summary.habitCompletions}</strong> habits,
            focused for <strong>{Math.round(totalFocus / 60)} hours</strong> and read <strong>{summary.pagesRead}</strong> pages.
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
        <div className="ins-hero-scores">
          <div><strong>{pct(summary.habitConsistency)}%</strong><span>of habits kept</span></div>
          <div><strong>{pct(summary.avgGoalProgress)}%</strong><span>average goal progress</span></div>
        </div>
      </section>

      {/* ── KPIs ───────────────────────────────────────────── */}
      <div className="ins-kpis">
        <Kpi icon={Trophy} label="Longest streak" value={`${summary.longestStreak} days`} meta="in a row, without missing" tone="amber" />
        <Kpi icon={Timer} label="Time focused" value={`${Math.floor(summary.focusMinutes / 60)}h ${summary.focusMinutes % 60}m`} meta={`across ${summary.focusSessions} sessions`} />
        <Kpi icon={Footprints} label="Running" value={`${runs.minutes || 0} min`} meta={`${runs.count || 0} runs`} tone="green" />
        <Kpi icon={BookOpen} label="Pages read" value={summary.pagesRead} meta={`${summary.booksFinished} books finished`} tone="pink" />
      </div>

      {/* ── This week ─────────────────────────────────────── */}
      {weekly && (
        <section className="ins-week">
          <div className="ins-week-head">
            <div>
              <span className="weekly-badge"><Sparkles size={13} /> This week</span>
              <h2>{weekVerdict}</h2>
              <p className="text-muted">
                {safeDate(weekly.range.from, 'd MMM')} – {safeDate(weekly.range.to, 'd MMM')}
              </p>
            </div>
          </div>
          <div className="ins-week-grid">
            <div className="ins-week-stat">
              <strong>{weekly.habitRate}%</strong>
              <span>habits done</span>
              <em>{weekly.habitCompletions} of {weekly.habitPossible} check-ins</em>
            </div>
            <div className="ins-week-stat">
              <strong>{weekly.focusMinutes} min</strong>
              <span>focused</span>
              <em className={weekly.focusDelta >= 0 ? 'up' : 'down'}>
                {weekly.focusDelta === 0 ? <Minus size={11} /> : weekly.focusDelta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {weekly.focusDelta === 0 ? 'same as last week' : `${Math.abs(weekly.focusDelta)} min ${weekly.focusDelta > 0 ? 'more' : 'less'} than last week`}
              </em>
            </div>
            <div className="ins-week-stat">
              <strong>{weekly.goalsTouched}</strong>
              <span>goals moved forward</span>
              <em>{weekly.goalsCompleted} finished</em>
            </div>
            <div className="ins-week-stat">
              <strong>{weekly.inboxCleared}</strong>
              <span>inbox items cleared</span>
              <em>{weekly.notesCreated} notes written</em>
            </div>
          </div>
          <div className="dw-week ins-week-bars" role="img" aria-label="Habits completed each day this week">
            {(() => {
              const max = Math.max(1, ...weekly.daily.map((d) => d.habits));
              return weekly.daily.map((day) => (
                <div key={day.date} className="dw-day" title={`${day.habits} habits · ${day.focus} min focused`}>
                  <span className="dw-day-val">{day.habits || ''}</span>
                  <span className="dw-day-bar"><i style={{ height: `${Math.max(4, (day.habits / max) * 100)}%`, opacity: day.habits ? 1 : 0.25 }} /></span>
                  <span className="dw-day-name">{safeDate(day.date, 'EEE')}</span>
                </div>
              ));
            })()}
          </div>
          <p className="ins-caption">Each bar is how many habits you checked off that day.</p>
        </section>
      )}

      {/* ── Habits ─────────────────────────────────────────── */}
      <h2 className="ins-section-title"><Flame size={16} /> Habits</h2>
      <div className="dw-grid">
        <Widget
          icon={CalendarDays}
          title="Habit calendar"
          hint="Last 5 weeks. Green tick = every habit done that day."
          tone="var(--accent-green, #10b981)"
        >
          {data.heatmap?.length
            ? <HabitCalendar cells={data.heatmap} />
            : <p className="dw-empty">Check off a habit and your calendar starts filling in.</p>}
        </Widget>

        <Widget
          icon={Flame}
          title="Your habits"
          hint={`How often you kept each habit in the last ${rangeLabel}.`}
          tone="var(--accent-yellow, #f59e0b)"
        >
          {habitBreakdown.length ? habitBreakdown.slice(0, 8).map((h) => (
            <BarRow
              key={h._id}
              label={`${h.icon || '✅'} ${h.name}`}
              value={h.consistency}
              right={`${pct(h.consistency)}%${streakById[h._id] ? ` · 🔥 ${streakById[h._id]}` : ''}`}
              color="var(--accent-yellow, #f59e0b)"
            />
          )) : <p className="dw-empty">No habits yet.</p>}
        </Widget>
      </div>

      {/* ── Focus & goals ─────────────────────────────────── */}
      <h2 className="ins-section-title"><Target size={16} /> Focus &amp; goals</h2>
      <div className="dw-grid">
        <Widget
          icon={Timer}
          title="Focus per week"
          hint={totalFocus ? `${totalFocus} minutes of focus and running in the last ${rangeLabel}.` : 'Start a focus block to see your weeks here.'}
          tone="var(--chart-1)"
        >
          {focusWeeks.some((w) => w.minutes) ? (
            <div className="ins-hbars">
              {focusWeeks.map((w) => (
                <div key={w.label} className="ins-hbar">
                  <span className="ins-hbar-label">{w.label}</span>
                  <span className="ins-hbar-track"><i style={{ width: `${(w.minutes / maxWeek) * 100}%` }} /></span>
                  <span className="ins-hbar-val">{w.minutes ? `${w.minutes}m` : '—'}</span>
                </div>
              ))}
            </div>
          ) : <p className="dw-empty">No focus sessions in this period.</p>}
        </Widget>

        <Widget icon={Target} title="Goals" hint="How far along each goal is." tone="var(--chart-2)">
          {goals.length
            ? goals.map((g) => <BarRow key={g._id || g.title} label={g.title} value={g.progress} color="var(--chart-2)" />)
            : <p className="dw-empty">No active goals yet.</p>}
        </Widget>
      </div>
    </div>
  );
}
