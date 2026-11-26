/* ─── Run tracker ──────────────────────────────────────────
   A stopwatch for workouts outside. The start time lives in
   localStorage so a locked phone, a closed tab or a reload
   never loses the run. Optional GPS adds up the distance.   */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import {
  Play, Pause, Square, Flag, MapPin, Footprints, Flame, Timer, Route, Trash2, RotateCcw,
} from 'lucide-react';
import { logFocusSession, deleteFocusSession } from '../../utils/api';
import { ChartCard, AreaTrend } from '../Charts/ChartKit';
import './RunTracker.css';

const RUN_KEY = 'sortlife_active_run';

function readRun() {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeRun(run) {
  try {
    if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run));
    else localStorage.removeItem(RUN_KEY);
  } catch { /* ignore */ }
}

function clock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function pace(seconds, km) {
  if (!km || km <= 0) return '—';
  const perKm = seconds / km;
  return `${Math.floor(perKm / 60)}:${String(Math.round(perKm % 60)).padStart(2, '0')} /km`;
}

/* run = { startedAt, pausedTotal, pausedAt|null, laps:[seconds], km, gps } */
function elapsedOf(run, now = Date.now()) {
  if (!run) return 0;
  const end = run.pausedAt || now;
  return Math.max(0, (end - run.startedAt - (run.pausedTotal || 0)) / 1000);
}

export default function RunTracker({ data, onChanged }) {
  const [run, setRun] = useState(readRun);
  const [, force] = useState(0);
  const [label, setLabel] = useState('');
  const [manualKm, setManualKm] = useState('');
  const watchRef = useRef(null);
  const lastPointRef = useRef(null);

  useEffect(() => { writeRun(run); }, [run]);

  /* Re-render twice a second while the clock is live. */
  useEffect(() => {
    if (!run || run.pausedAt) return undefined;
    const id = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [run]);

  const stopGps = useCallback(() => {
    if (watchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = null;
    lastPointRef.current = null;
  }, []);

  /* GPS distance — only while running and the user opted in. */
  useEffect(() => {
    if (!run?.gps || run.pausedAt || !navigator.geolocation) {
      stopGps();
      return undefined;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        if (pos.coords.accuracy > 40) return; // too noisy to trust
        const prev = lastPointRef.current;
        lastPointRef.current = point;
        if (!prev) return;
        const step = haversineKm(prev, point);
        if (step < 0.003 || step > 0.5) return; // jitter or a GPS jump
        setRun((r) => (r ? { ...r, km: Math.round(((r.km || 0) + step) * 1000) / 1000 } : r));
      },
      () => {
        toast.error('Location unavailable — enter the distance by hand.');
        setRun((r) => (r ? { ...r, gps: false } : r));
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    return stopGps;
  }, [run?.gps, run?.pausedAt, stopGps]);

  useEffect(() => {
    if (!run || run.pausedAt) return undefined;
    document.title = `${clock(elapsedOf(run))} · Run — SortLife`;
    return () => { document.title = 'Focus · SortLife'; };
  });

  const start = (gps) => {
    setRun({ startedAt: Date.now(), pausedTotal: 0, pausedAt: null, laps: [], km: 0, gps: !!gps });
  };

  const pauseResume = () => {
    setRun((r) => {
      if (!r) return r;
      if (r.pausedAt) return { ...r, pausedTotal: (r.pausedTotal || 0) + (Date.now() - r.pausedAt), pausedAt: null };
      return { ...r, pausedAt: Date.now() };
    });
  };

  const lap = () => setRun((r) => (r ? { ...r, laps: [...(r.laps || []), elapsedOf(r)] } : r));

  const discard = () => {
    stopGps();
    setRun(null);
    setManualKm('');
  };

  const finish = async () => {
    const seconds = Math.round(elapsedOf(run));
    if (seconds < 30) {
      toast('Runs under 30 seconds are not saved.');
      discard();
      return;
    }
    const km = manualKm !== '' ? Number(manualKm) : run.km || null;
    try {
      await logFocusSession({
        kind: 'run',
        minutes: Math.max(1, Math.min(600, Math.ceil(seconds / 60))),
        seconds,
        completed: true,
        label: label.trim() || 'Run',
        distance: km && Number.isFinite(km) ? km : null,
      });
      toast.success(`Run saved — ${clock(seconds)}${km ? ` · ${Number(km).toFixed(2)} km` : ''}`);
      discard();
      setLabel('');
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Run could not be saved');
    }
  };

  const remove = async (id) => {
    try {
      await deleteFocusSession(id);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not remove that');
    }
  };

  const elapsed = elapsedOf(run);
  const km = manualKm !== '' ? Number(manualKm) || 0 : run?.km || 0;
  const stats = data?.runStats || {};
  const runs = (data?.sessions || []).filter((s) => s.kind === 'run');
  const laps = run?.laps || [];

  return (
    <div className="run-layout">
      <section className={`run-hero ${run && !run.pausedAt ? 'is-live' : ''}`}>
        <div className="run-hero-badge"><Footprints size={14} /> {run ? (run.pausedAt ? 'Paused' : 'Running') : 'Ready to run'}</div>
        <div className="run-clock" role="timer">{clock(elapsed)}</div>
        <div className="run-metrics">
          <div><strong>{km ? km.toFixed(2) : '0.00'}</strong><span>km</span></div>
          <div><strong>{pace(elapsed, km)}</strong><span>pace</span></div>
          <div><strong>{laps.length}</strong><span>laps</span></div>
        </div>

        {!run ? (
          <div className="run-start">
            <input className="run-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Morning run, park loop…" maxLength={200} />
            <div className="run-start-btns">
              <button type="button" className="run-btn run-btn--go" onClick={() => start(false)}>
                <Play size={18} /> Start run
              </button>
              {'geolocation' in navigator && (
                <button type="button" className="run-btn run-btn--ghost" onClick={() => start(true)}>
                  <MapPin size={16} /> Start with GPS
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="run-controls">
              <button type="button" className="run-round" onClick={lap} disabled={!!run.pausedAt} aria-label="Lap"><Flag size={18} /></button>
              <button type="button" className="run-round run-round--main" onClick={pauseResume} aria-label={run.pausedAt ? 'Resume' : 'Pause'}>
                {run.pausedAt ? <Play size={26} /> : <Pause size={26} />}
              </button>
              <button type="button" className="run-round run-round--stop" onClick={finish} aria-label="Finish and save"><Square size={18} /></button>
            </div>
            <div className="run-extra">
              <label>
                Distance (km){run.gps ? ' — GPS on, override:' : ''}
                <input type="number" min="0" step="0.01" value={manualKm} onChange={(e) => setManualKm(e.target.value)} placeholder={run.gps ? (run.km || 0).toFixed(2) : '5.00'} />
              </label>
              <button type="button" className="run-link" onClick={discard}><RotateCcw size={13} /> Discard</button>
            </div>
            {laps.length > 0 && (
              <ol className="run-laps">
                {laps.map((t, i) => (
                  <li key={i}><span>Lap {i + 1}</span><b>{clock(t - (laps[i - 1] || 0))}</b><em>{clock(t)}</em></li>
                ))}
              </ol>
            )}
          </>
        )}
      </section>

      <div className="run-side">
        <div className="run-stats">
          <div><Timer size={15} /><strong>{stats.todayMinutes || 0}m</strong><span>today</span></div>
          <div><Flame size={15} /><strong>{stats.streak || 0}</strong><span>day streak</span></div>
          <div><Route size={15} /><strong>{stats.totalDistance || 0} km</strong><span>30 days</span></div>
          <div><Footprints size={15} /><strong>{stats.totalRuns || 0}</strong><span>runs · longest {stats.longestMinutes || 0}m</span></div>
        </div>

        <ChartCard title="Running minutes" subtitle="Last 30 days" icon={Footprints} empty={!(data?.daily || []).some((d) => d.run)} emptyText="Your first run will show up here.">
          <AreaTrend
            data={data?.daily || []}
            series={[{ key: 'run', name: 'Running', color: 'var(--chart-4)' }]}
            unit=" min"
            height={200}
            xFormatter={(v) => (v ? format(parseISO(v), 'd MMM') : '')}
          />
        </ChartCard>

        <section className="card card-pad">
          <div className="section-head"><h2>Recent runs</h2></div>
          {!runs.length ? (
            <p className="text-muted" style={{ fontSize: 13 }}>No runs logged yet. Lace up.</p>
          ) : (
            <ul className="focus-log">
              {runs.slice(0, 10).map((r) => (
                <li key={r._id} className="is-complete">
                  <span className="focus-log-dot kind-run" />
                  <div className="grow">
                    <strong className="truncate">{r.label || 'Run'}</strong>
                    <span>{format(new Date(r.startedAt), 'd MMM, HH:mm')}{r.distance ? ` · ${r.distance} km · ${pace(r.seconds, r.distance)}` : ''}</span>
                  </div>
                  <span className="focus-log-min tabular">{clock(r.seconds || 0)}</span>
                  <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" onClick={() => remove(r._id)} aria-label="Remove run">
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
