import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { BookOpen, Target, Flame, Inbox, Timer, FolderKanban } from 'lucide-react';
import './DashboardCharts.css';

/*
 * Plain-language dashboard. Every widget answers one everyday question
 * ("how far along am I?", "did I keep my streak?") with a progress bar,
 * a number and a sentence — no bubbles, radars or treemaps to decode.
 */

const pct = (n) => Math.max(0, Math.min(100, Math.round(n || 0)));

function Widget({ icon: Icon, title, hint, tone = 'var(--accent)', children, empty, emptyText }) {
  return (
    <section className="dw" style={{ '--tone': tone }}>
      <header className="dw-head">
        <span className="dw-icon"><Icon size={16} /></span>
        <div>
          <h3>{title}</h3>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      {empty ? <p className="dw-empty">{emptyText}</p> : children}
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

export default function DashboardCharts({ stats }) {
  const {
    bookProgress = [], goalProgress = [], habitStats = [], projectProgress = [],
    inboxByStatus = {}, focusDaily = [],
  } = stats || {};

  const goals = useMemo(() => goalProgress
    .filter((g) => g.status !== 'abandoned')
    .sort((a, b) => (b.progress || 0) - (a.progress || 0))
    .slice(0, 5), [goalProgress]);

  const habits = useMemo(() => [...habitStats]
    .sort((a, b) => (b.streak || 0) - (a.streak || 0))
    .slice(0, 6), [habitStats]);
  const topStreak = habits[0]?.streak || 0;

  const reading = useMemo(() => bookProgress
    .filter((b) => (b.currentPage || 0) > 0 && (b.progress || 0) < 100)
    .slice(0, 4), [bookProgress]);

  const projects = useMemo(() => projectProgress
    .filter((p) => p.status !== 'completed')
    .slice(0, 4), [projectProgress]);

  const days = focusDaily.slice(-7);
  const weekFocus = days.reduce((s, d) => s + (d.focus || 0) + (d.run || 0), 0);
  const maxDay = Math.max(1, ...days.map((d) => (d.focus || 0) + (d.run || 0)));
  const bestDay = days.reduce((best, d) => (((d.focus || 0) + (d.run || 0)) > ((best?.focus || 0) + (best?.run || 0)) ? d : best), null);

  const open = inboxByStatus.open || 0;
  const done = inboxByStatus.done || 0;
  const inboxRate = open + done ? Math.round((done / (open + done)) * 100) : 0;

  if (!stats) return null;

  const dayLabel = (d) => { try { return format(parseISO(d.date), 'EEE'); } catch { return ''; } };

  return (
    <div className="dw-grid">
      <Widget
        icon={Timer}
        title="This week's focus"
        hint={weekFocus
          ? `${weekFocus} minutes in the last 7 days${bestDay ? ` · best day ${dayLabel(bestDay)}` : ''}`
          : 'Start a focus block to fill this in.'}
        tone="var(--chart-1)"
        empty={!weekFocus}
        emptyText="No focus time yet this week. One 25-minute block is a great start."
      >
        <div className="dw-week">
          {days.map((d) => {
            const total = (d.focus || 0) + (d.run || 0);
            return (
              <div key={d.date} className="dw-day" title={`${total} min`}>
                <span className="dw-day-val">{total || ''}</span>
                <span className="dw-day-bar"><i style={{ height: `${Math.max(4, (total / maxDay) * 100)}%`, opacity: total ? 1 : 0.25 }} /></span>
                <span className="dw-day-name">{dayLabel(d)}</span>
              </div>
            );
          })}
        </div>
      </Widget>

      <Widget
        icon={Flame}
        title="Habit streaks"
        hint={topStreak ? `Your best streak right now is ${topStreak} day${topStreak === 1 ? '' : 's'}.` : 'Check a habit off today to start a streak.'}
        tone="var(--accent-yellow, #f59e0b)"
        empty={!habits.length}
        emptyText="Add a habit and its streak shows up here."
      >
        <ul className="dw-habits">
          {habits.map((h) => (
            <li key={h._id || h.name}>
              <span className="dw-habit-dot" style={{ background: h.color || 'var(--accent)' }} />
              <span className="dw-habit-name">{h.name}</span>
              <span className="dw-habit-streak">🔥 {h.streak || 0} day{(h.streak || 0) === 1 ? '' : 's'}</span>
            </li>
          ))}
        </ul>
      </Widget>

      <Widget
        icon={Target}
        title="Goals"
        hint="How far along each goal is."
        tone="var(--chart-2)"
        empty={!goals.length}
        emptyText="Set a goal and you'll see its progress here."
      >
        {goals.map((g) => <BarRow key={g._id || g.title}label={g.title} value={g.progress} color="var(--chart-2)" />)}
      </Widget>

      <Widget
        icon={Inbox}
        title="Inbox"
        hint={open ? `${open} thing${open === 1 ? '' : 's'} still waiting to be sorted.` : 'Inbox zero — nice.'}
        tone="var(--accent-green, #10b981)"
      >
        <div className="dw-big">
          <strong>{inboxRate}%</strong>
          <span>of everything you captured is done</span>
        </div>
        <BarRow label="Cleared" value={inboxRate} right={`${done} done · ${open} open`} color="var(--accent-green, #10b981)" />
      </Widget>

      <Widget
        icon={BookOpen}
        title="Currently reading"
        hint="Where you are in each book."
        tone="var(--chart-3)"
        empty={!reading.length}
        emptyText="Start a book and your progress shows here."
      >
        {reading.map((b) => (
          <BarRow
            key={b._id || b.title}
            label={b.title}
            value={b.progress}
            right={b.totalPages ? `p.${b.currentPage} of ${b.totalPages}` : `p.${b.currentPage}`}
            color="var(--chart-3)"
          />
        ))}
      </Widget>

      {projects.length > 0 && (
        <Widget icon={FolderKanban} title="Projects" hint="Open projects and how close they are." tone="var(--chart-4)">
          {projects.map((p) => <BarRow key={p._id || p.title}label={p.title} value={p.progress} color="var(--chart-4)" />)}
        </Widget>
      )}
    </div>
  );
}
