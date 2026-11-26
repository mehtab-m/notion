import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { BookOpen, Target, Flame, Inbox, Timer, Radar as RadarIcon, Tv, FolderKanban } from 'lucide-react';
import {
  ChartCard, ChartGrid, DonutChart, ConcentricRings, BubbleChart, AreaTrend,
  TapeDiagram, RadarWeb, TreemapChart, Gauge,
} from '../Charts/ChartKit';

const pretty = (s) => String(s).replace(/-/g, ' ');
const short = (s, n = 14) => (s.length > n ? `${s.slice(0, n)}…` : s);
const toSlices = (obj) => Object.entries(obj || {})
  .filter(([, v]) => v > 0)
  .map(([name, value]) => ({ name: pretty(name), value }));

export default function DashboardCharts({ stats }) {
  const {
    bookProgress = [], goalProgress = [], habitStats = [], projectProgress = [],
    booksByStatus = {}, goalsByStatus = {}, showsByStatus = {},
    inboxByStatus = {}, inboxByPriority = {}, focusDaily = [],
  } = stats || {};

  const bookPie = useMemo(() => toSlices(booksByStatus), [booksByStatus]);
  const showPie = useMemo(() => toSlices(showsByStatus), [showsByStatus]);

  const goalRings = useMemo(() => goalProgress
    .filter((g) => g.status !== 'abandoned')
    .slice(0, 6)
    .map((g) => ({ name: short(g.title), value: g.progress || 0 })), [goalProgress]);

  const habitBubbles = useMemo(() => habitStats.map((h) => ({
    name: h.name,
    x: h.streak || 0,
    y: h.completedCount || 0,
    z: Math.max(1, (h.streak || 0) + (h.completedCount || 0)),
    color: h.color || undefined,
  })), [habitStats]);

  const tapeRows = useMemo(() => [
    { label: 'Goals', segments: toSlices(goalsByStatus) },
    { label: 'Inbox', segments: toSlices(inboxByStatus) },
    { label: 'Open inbox by priority', segments: [
      { name: 'high', value: inboxByPriority.high || 0, color: 'var(--accent-red, #EF4444)' },
      { name: 'medium', value: inboxByPriority.medium || 0, color: 'var(--accent-yellow, #F59E0B)' },
      { name: 'low', value: inboxByPriority.low || 0, color: 'var(--accent-green, #10B981)' },
    ] },
  ], [goalsByStatus, inboxByStatus, inboxByPriority]);

  const readingTree = useMemo(() => bookProgress
    .filter((b) => (b.currentPage || 0) > 0)
    .map((b) => ({ name: b.title, value: b.currentPage })), [bookProgress]);

  const radar = useMemo(() => {
    const avg = (arr, k) => (arr.length ? Math.round(arr.reduce((s, x) => s + (x[k] || 0), 0) / arr.length) : 0);
    const topStreak = habitStats.reduce((m, h) => Math.max(m, h.streak || 0), 0);
    const focusMin = focusDaily.reduce((s, d) => s + d.focus, 0);
    const runMin = focusDaily.reduce((s, d) => s + d.run, 0);
    return [
      { metric: 'Reading', score: avg(bookProgress, 'progress') },
      { metric: 'Goals', score: avg(goalProgress, 'progress') },
      { metric: 'Streaks', score: Math.min(100, topStreak * 7) },
      { metric: 'Focus', score: Math.min(100, Math.round(focusMin / 6)) },
      { metric: 'Fitness', score: Math.min(100, Math.round(runMin / 3)) },
      { metric: 'Projects', score: avg(projectProgress, 'progress') },
    ];
  }, [bookProgress, goalProgress, habitStats, focusDaily, projectProgress]);

  const inboxTotal = (inboxByStatus.open || 0) + (inboxByStatus.done || 0);
  const inboxRate = inboxTotal ? Math.round(((inboxByStatus.done || 0) / inboxTotal) * 100) : 0;
  const hasFocus = focusDaily.some((d) => d.focus || d.run);

  if (!stats) return null;

  return (
    <div className="dashboard-charts-kit">
      <ChartGrid cols={3}>
        <ChartCard title="Library mix" subtitle="Books by status" icon={BookOpen} empty={!bookPie.length} emptyText="Add a book to see your library mix.">
          <DonutChart data={bookPie} centerLabel="books" />
        </ChartCard>
        <ChartCard title="Watchlist" subtitle="Shows by status" icon={Tv} empty={!showPie.length} emptyText="Add a show to fill this pie.">
          <DonutChart data={showPie} full />
        </ChartCard>
        <ChartCard title="Inbox cleared" subtitle="Done vs everything captured" icon={Inbox}>
          <Gauge value={inboxRate} label={`${inboxByStatus.open || 0} still open`} height={200} color="var(--chart-4)" />
        </ChartCard>
      </ChartGrid>

      <ChartGrid cols={2}>
        <ChartCard title="Goal orbits" subtitle="Each ring is one goal's progress" icon={Target} empty={!goalRings.length} emptyText="Set a goal and it becomes a ring here.">
          <ConcentricRings data={goalRings} />
        </ChartCard>
        <ChartCard title="Habit bubbles" subtitle="Streak → total check-ins, size = effort" icon={Flame} empty={!habitBubbles.length} emptyText="Track a habit to see its bubble.">
          <BubbleChart data={habitBubbles} xLabel="Current streak" yLabel="Check-ins" zLabel="Effort" />
        </ChartCard>
      </ChartGrid>

      <ChartGrid cols={1}>
        <ChartCard title="Focus & running" subtitle="Minutes per day, last 14 days" icon={Timer} empty={!hasFocus} emptyText="Start a focus block or log a run to fill this area.">
          <AreaTrend
            data={focusDaily}
            series={[{ key: 'focus', name: 'Focus' }, { key: 'run', name: 'Running', color: 'var(--chart-4)' }]}
            stacked
            unit=" min"
            xFormatter={(v) => (v ? format(parseISO(v), 'd MMM') : '')}
          />
        </ChartCard>
      </ChartGrid>

      <ChartGrid cols={2}>
        <ChartCard title="Where things stand" subtitle="Tape diagram of every pipeline" icon={FolderKanban}>
          <TapeDiagram rows={tapeRows} />
        </ChartCard>
        <ChartCard title="Life radar" subtitle="Composite signal across modules" icon={RadarIcon}>
          <RadarWeb data={radar} />
        </ChartCard>
      </ChartGrid>

      {readingTree.length > 0 && (
        <ChartGrid cols={1}>
          <ChartCard title="Pages read" subtitle="Treemap — bigger tile, more pages" icon={BookOpen}>
            <TreemapChart data={readingTree} />
          </ChartCard>
        </ChartGrid>
      )}
    </div>
  );
}
