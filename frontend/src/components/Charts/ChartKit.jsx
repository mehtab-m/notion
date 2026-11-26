/* ─── ChartKit ─────────────────────────────────────────────
   One set of chart building blocks used by Dashboard, Insights,
   Goals, Habits, Money, Focus and Admin so every chart in the
   app reads as the same system. Deliberately no line charts —
   trends are areas, comparisons are bubbles / bars / rings.   */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  RadialBarChart, RadialBar, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, Treemap, LabelList,
} from 'recharts';
import { Play, Pause, RotateCcw } from 'lucide-react';
import './ChartKit.css';

export const PALETTE = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)',
  '#14B8A6', '#F97316', '#8B5CF6', '#EC4899', '#84CC16',
];
export const colorAt = (i) => PALETTE[i % PALETTE.length];

const AXIS_TICK = { fontSize: 11, fill: 'var(--text-muted)' };

export function KitTooltip({ active, payload, label, unit = '', labelFormatter }) {
  if (!active || !payload?.length) return null;
  const head = labelFormatter ? labelFormatter(label, payload) : (label ?? payload[0]?.payload?.name ?? payload[0]?.name);
  return (
    <div className="kit-tip">
      {head != null && head !== '' && <strong>{head}</strong>}
      {payload.map((p, i) => (
        <div key={`${p.dataKey}-${i}`} className="kit-tip-row">
          <i style={{ background: p.color || p.payload?.fill || p.fill }} />
          <span>{p.name}: <b>{typeof p.value === 'number' ? Math.round(p.value * 100) / 100 : p.value}{p.unit || unit}</b></span>
        </div>
      ))}
    </div>
  );
}

export function ChartCard({ title, subtitle, icon: Icon, wide, tall, children, empty, emptyText, action, className = '' }) {
  return (
    <section className={`kit-card ${wide ? 'kit-card--wide' : ''} ${tall ? 'kit-card--tall' : ''} ${className}`}>
      <header className="kit-card-head">
        <div>
          <h3>{Icon && <Icon size={15} />} {title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {empty ? <div className="kit-empty">{emptyText || 'Nothing to chart yet.'}</div> : children}
    </section>
  );
}

export function ChartGrid({ children, cols = 2 }) {
  return <div className={`kit-grid kit-grid--${cols}`}>{children}</div>;
}

/* ── Pie / donut ─────────────────────────────────────────── */
export function DonutChart({ data, height = 230, inner = 55, centerLabel, centerValue, full = false }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  return (
    <div className="kit-donut" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={full ? 0 : `${inner}%`}
            outerRadius="82%"
            paddingAngle={full ? 1 : 3}
            stroke="var(--bg-card)"
            strokeWidth={2}
            label={full ? ({ percent }) => `${Math.round(percent * 100)}%` : false}
            labelLine={false}
          >
            {data.map((d, i) => <Cell key={d.name} fill={d.color || colorAt(i)} />)}
          </Pie>
          <Tooltip content={<KitTooltip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      {!full && (
        <div className="kit-donut-center">
          <strong>{centerValue ?? total}</strong>
          <span>{centerLabel || 'total'}</span>
        </div>
      )}
    </div>
  );
}

/* ── Concentric / circular rings ─────────────────────────── */
export function ConcentricRings({ data, height = 250, max = 100, unit = '%' }) {
  const rows = data.map((d, i) => ({ ...d, fill: d.color || colorAt(i) })).reverse();
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="22%" outerRadius="98%" data={rows} startAngle={90} endAngle={-270} barSize={11}>
          <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
          <RadialBar dataKey="value" background={{ fill: 'var(--bg-tertiary, rgba(127,127,127,.12))' }} cornerRadius={8} />
          <Tooltip content={<KitTooltip unit={unit} />} />
          <Legend iconType="circle" iconSize={8} layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Bubble chart (x, y, size) ───────────────────────────── */
export function BubbleChart({ data, height = 260, xLabel = 'x', yLabel = 'y', zLabel = 'size', zRange = [80, 900] }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 16, bottom: 18, left: -6 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name={xLabel} tick={AXIS_TICK} label={{ value: xLabel, position: 'insideBottom', offset: -8, fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis type="number" dataKey="y" name={yLabel} tick={AXIS_TICK} />
          <ZAxis type="number" dataKey="z" name={zLabel} range={zRange} />
          <Tooltip content={<BubbleTip xLabel={xLabel} yLabel={yLabel} zLabel={zLabel} />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={data} fillOpacity={0.72}>
            {data.map((d, i) => <Cell key={d.name || i} fill={d.color || colorAt(i)} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function BubbleTip({ active, payload, xLabel, yLabel, zLabel }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="kit-tip">
      <strong>{p.name}</strong>
      <div className="kit-tip-row"><span>{xLabel}: <b>{p.x}</b></span></div>
      <div className="kit-tip-row"><span>{yLabel}: <b>{p.y}</b></span></div>
      {p.z != null && <div className="kit-tip-row"><span>{zLabel}: <b>{p.z}</b></span></div>}
    </div>
  );
}

/* ── Bubble race — bubbles moving frame by frame ─────────── */
export function BubbleRace({ frames, height = 280, xLabel = 'x', yLabel = 'y', zLabel = 'size', interval = 900 }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const last = Math.max(0, (frames?.length || 1) - 1);

  useEffect(() => { setIndex(0); setPlaying(true); }, [frames]);

  useEffect(() => {
    if (!playing || !frames?.length) return undefined;
    if (index >= last) { setPlaying(false); return undefined; }
    const t = setTimeout(() => setIndex((i) => Math.min(last, i + 1)), interval);
    return () => clearTimeout(t);
  }, [playing, index, last, interval, frames]);

  const bounds = useMemo(() => {
    const pts = (frames || []).flatMap((f) => f.points);
    return {
      x: [0, Math.max(1, ...pts.map((p) => p.x)) * 1.1],
      y: [0, Math.max(1, ...pts.map((p) => p.y)) * 1.1],
    };
  }, [frames]);

  if (!frames?.length) return <div className="kit-empty">Nothing to race yet.</div>;
  const frame = frames[index];
  const names = frames[last].points.map((p) => p.name);

  return (
    <div className="kit-race">
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 16, bottom: 18, left: -6 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name={xLabel} domain={bounds.x} tick={AXIS_TICK} allowDecimals={false}
              label={{ value: xLabel, position: 'insideBottom', offset: -8, fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis type="number" dataKey="y" name={yLabel} domain={bounds.y} tick={AXIS_TICK} allowDecimals={false} />
            <ZAxis type="number" dataKey="z" range={[60, 1000]} name={zLabel} />
            <Tooltip content={<BubbleTip xLabel={xLabel} yLabel={yLabel} zLabel={zLabel} />} />
            <Scatter data={frame.points} fillOpacity={0.75} isAnimationActive animationDuration={interval - 100}>
              {frame.points.map((p) => <Cell key={p.name} fill={colorAt(names.indexOf(p.name))} />)}
              <LabelList dataKey="name" position="top" style={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div className="kit-race-stamp">{frame.label}</div>
      </div>
      <div className="kit-race-controls">
        <button type="button" className="kit-icon-btn" onClick={() => { if (index >= last) setIndex(0); setPlaying((p) => !p); }} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button type="button" className="kit-icon-btn" onClick={() => { setIndex(0); setPlaying(true); }} aria-label="Restart">
          <RotateCcw size={14} />
        </button>
        <input type="range" min={0} max={last} value={index} onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }} />
      </div>
    </div>
  );
}

/* ── Area chart (stackable) ──────────────────────────────── */
export function AreaTrend({ data, xKey = 'date', series, height = 240, stacked = false, xFormatter, unit = '' }) {
  const id = useMemo(() => `ak${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color || colorAt(i)} stopOpacity={0.5} />
                <stop offset="100%" stopColor={s.color || colorAt(i)} stopOpacity={0.03} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS_TICK} tickFormatter={xFormatter} minTickGap={28} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<KitTooltip unit={unit} labelFormatter={xFormatter ? (l) => xFormatter(l) : undefined} />} />
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stackId={stacked ? 'a' : undefined}
              stroke={s.color || colorAt(i)}
              strokeWidth={2}
              fill={`url(#${id}-${i})`}
            />
          ))}
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Scatter plot ────────────────────────────────────────── */
export function ScatterPlot({ data, height = 240, xLabel = 'x', yLabel = 'y', xDomain, yDomain, xTicks, xFormatter, color = 'var(--chart-2)' }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 16, bottom: 18, left: -6 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name={xLabel} domain={xDomain || ['auto', 'auto']} ticks={xTicks} tickFormatter={xFormatter} tick={AXIS_TICK}
            label={{ value: xLabel, position: 'insideBottom', offset: -8, fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis type="number" dataKey="y" name={yLabel} domain={yDomain || ['auto', 'auto']} tick={AXIS_TICK} />
          <Tooltip content={<BubbleTip xLabel={xLabel} yLabel={yLabel} />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={data} fill={color} fillOpacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Waterfall — running total built from +/- steps ──────── */
export function Waterfall({ data, height = 250, unit = '' }) {
  const rows = useMemo(() => {
    let run = 0;
    const out = data.map((d) => {
      const start = run;
      run += d.value;
      return {
        name: d.name,
        base: Math.min(start, run),
        delta: Math.abs(d.value),
        raw: d.value,
        fill: d.value >= 0 ? 'var(--accent-green, #10B981)' : 'var(--accent-red, #EF4444)',
      };
    });
    out.push({ name: 'Total', base: Math.min(0, run), delta: Math.abs(run), raw: run, fill: 'var(--chart-1)' });
    return out;
  }, [data]);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<WaterfallTip unit={unit} />} cursor={{ fill: 'rgba(127,127,127,.08)' }} />
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="delta" stackId="w" radius={[5, 5, 0, 0]}>
            {rows.map((r, i) => <Cell key={i} fill={r.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function WaterfallTip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="kit-tip">
      <strong>{p.name}</strong>
      <div className="kit-tip-row"><span>{p.name === 'Total' ? 'Total' : 'Change'}: <b>{p.raw > 0 && p.name !== 'Total' ? '+' : ''}{Math.round(p.raw * 100) / 100}{unit}</b></span></div>
    </div>
  );
}

/* ── Tape diagram — one bar split into proportional parts ── */
export function TapeDiagram({ rows }) {
  // rows: [{ label, segments: [{ name, value, color? }] }]
  return (
    <div className="kit-tape">
      {rows.map((row) => {
        const total = row.segments.reduce((s, x) => s + (x.value || 0), 0);
        return (
          <div key={row.label} className="kit-tape-row">
            <div className="kit-tape-label">
              <span>{row.label}</span>
              <em>{total}</em>
            </div>
            <div className="kit-tape-bar">
              {total === 0 ? <span className="kit-tape-empty">empty</span> : row.segments.filter((s) => s.value > 0).map((s, i) => (
                <span
                  key={s.name}
                  className="kit-tape-seg"
                  style={{ flexGrow: s.value, background: s.color || colorAt(i) }}
                  title={`${s.name}: ${s.value}`}
                >
                  {s.value / total > 0.12 ? `${s.name} · ${s.value}` : s.value}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Venn diagram — overlap of up to three sets ──────────── */
export function VennDiagram({ sets, overlaps, height = 250 }) {
  // sets: [{ name, size }] (2 or 3). overlaps: { ab, ac, bc, abc }
  const three = sets.length >= 3;
  const W = 320;
  const H = 240;
  const r = 78;
  const circles = three
    ? [{ cx: 120, cy: 95 }, { cx: 200, cy: 95 }, { cx: 160, cy: 160 }]
    : [{ cx: 125, cy: 120 }, { cx: 195, cy: 120 }];
  const labelPos = three
    ? [{ x: 70, y: 60 }, { x: 250, y: 60 }, { x: 160, y: 232 }]
    : [{ x: 80, y: 40 }, { x: 240, y: 40 }];
  const ov = overlaps || {};
  return (
    <div className="kit-venn" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label="Venn diagram">
        {sets.slice(0, 3).map((s, i) => (
          <circle key={s.name} cx={circles[i].cx} cy={circles[i].cy} r={r} fill={colorAt(i)} fillOpacity={0.28} stroke={colorAt(i)} strokeWidth={1.5} />
        ))}
        {sets.slice(0, 3).map((s, i) => (
          <text key={`l-${s.name}`} x={labelPos[i].x} y={labelPos[i].y} textAnchor="middle" className="kit-venn-label">
            {s.name} ({s.size})
          </text>
        ))}
        {three ? (
          <>
            <text x={160} y={78} textAnchor="middle" className="kit-venn-num">{ov.ab ?? 0}</text>
            <text x={122} y={150} textAnchor="middle" className="kit-venn-num">{ov.ac ?? 0}</text>
            <text x={198} y={150} textAnchor="middle" className="kit-venn-num">{ov.bc ?? 0}</text>
            <text x={160} y={122} textAnchor="middle" className="kit-venn-num kit-venn-num--core">{ov.abc ?? 0}</text>
          </>
        ) : (
          <text x={160} y={125} textAnchor="middle" className="kit-venn-num kit-venn-num--core">{ov.ab ?? 0}</text>
        )}
      </svg>
    </div>
  );
}

/* ── Radar web ───────────────────────────────────────────── */
export function RadarWeb({ data, height = 250, dataKey = 'score', nameKey = 'metric', max = 100 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="74%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey={nameKey} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
          <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
          <Radar dataKey={dataKey} name="Score" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.35} />
          <Tooltip content={<KitTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Treemap ─────────────────────────────────────────────── */
function TreeCell(props) {
  const { x, y, width, height, index, name, value } = props;
  if (width <= 0 || height <= 0) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} fill={colorAt(index || 0)} fillOpacity={0.85} stroke="var(--bg-card)" strokeWidth={2} />
      {width > 56 && height > 28 && (
        <text x={x + 8} y={y + 18} fill="#fff" fontSize={11} fontWeight={600}>
          {String(name).slice(0, Math.floor(width / 7))}
          <tspan x={x + 8} dy={14} fontWeight={400} opacity={0.85}>{value}</tspan>
        </text>
      )}
    </g>
  );
}

export function TreemapChart({ data, height = 240 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap data={data} dataKey="value" nameKey="name" content={<TreeCell />} isAnimationActive={false}>
          <Tooltip content={<KitTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Columns (simple bar) ────────────────────────────────── */
export function Columns({ data, xKey = 'name', series, height = 230, horizontal = false, stacked = false, unit = '' }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, left: horizontal ? 4 : -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey={xKey} width={96} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
            </>
          )}
          <Tooltip content={<KitTooltip unit={unit} />} cursor={{ fill: 'rgba(127,127,127,.08)' }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} stackId={stacked ? 's' : undefined} fill={s.color || colorAt(i)}
              radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} barSize={horizontal ? 14 : undefined} />
          ))}
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Gauge (half ring) ───────────────────────────────────── */
export function Gauge({ value, max = 100, label, height = 150, color = 'var(--chart-1)' }) {
  const pct = Math.max(0, Math.min(1, value / (max || 1)));
  const data = [{ name: label, value: pct * 100, fill: color }];
  return (
    <div className="kit-gauge" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={180} endAngle={0} cy="80%">
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" background={{ fill: 'var(--bg-tertiary, rgba(127,127,127,.12))' }} cornerRadius={10} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="kit-gauge-center">
        <strong>{Math.round(value)}{max === 100 ? '%' : ''}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
