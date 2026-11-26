import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Play, Pause, RotateCcw, SkipForward, Timer, Flame, Clock,
  CheckCircle2, Settings2, Trash2, Volume2, VolumeX, Footprints, Brain,
} from 'lucide-react';
import { getFocusSessions, logFocusSession, deleteFocusSession } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import RunTracker from '../components/Focus/RunTracker';
import './FocusPage.css';

const MODE_KEY = 'sortlife_focus_mode';

/* Classic pomodoro lengths, editable below. `long` fires after every
   fourth focus block, which is what makes the cycle a cycle. */
const DEFAULT_DURATIONS = { focus: 25, 'short-break': 5, 'long-break': 15 };
const LONG_BREAK_EVERY = 4;
const SETTINGS_KEY = 'sortlife_focus_settings';

const PHASES = [
  { id: 'focus', label: 'Focus' },
  { id: 'short-break', label: 'Short break' },
  { id: 'long-break', label: 'Long break' },
];

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_DURATIONS, sound: true, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_DURATIONS, sound: true };
}

function fmt(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * A short two-tone chime built with the Web Audio API. Shipping an audio
 * file for one 400ms sound is not worth the request or the bytes.
 */
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1174.7].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.22, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.36);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.4);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* Audio is a nicety — never let it break the timer. */
  }
}

export default function FocusPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(readSettings);
  const [phase, setPhase] = useState('focus');
  const [remaining, setRemaining] = useState(() => readSettings().focus * 60);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState('');
  const [completedCycles, setCompletedCycles] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  /* A run in progress wins: reopening the page mid-run lands on the run. */
  const [mode, setMode] = useState(() => {
    try {
      if (localStorage.getItem('sortlife_active_run')) return 'run';
      return localStorage.getItem(MODE_KEY) || 'focus';
    } catch { return 'focus'; }
  });
  useEffect(() => { try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ } }, [mode]);

  /* The timer is driven by a wall-clock deadline, not by counting
     setInterval ticks: a backgrounded tab throttles timers, and a
     tick-counter would silently run minutes slow. */
  const deadlineRef = useRef(null);
  const startedAtRef = useRef(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  const duration = (settings[phase] || DEFAULT_DURATIONS[phase]) * 60;

  const load = useCallback(async () => {
    try {
      setData(await getFocusSessions(30));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load your sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  /** Record what happened and move to whatever comes next. */
  const finish = useCallback(
    async (completed) => {
      const elapsed = startedAtRef.current
        ? Math.min(duration, Math.round((Date.now() - startedAtRef.current) / 1000))
        : duration - remainingRef.current;

      setRunning(false);
      deadlineRef.current = null;
      startedAtRef.current = null;

      const finishedPhase = phaseRef.current;
      const nextCycles = finishedPhase === 'focus' && completed ? completedCycles + 1 : completedCycles;
      if (finishedPhase === 'focus' && completed) setCompletedCycles(nextCycles);

      // Only sessions with real time on them are worth a database row.
      if (elapsed >= 30) {
        try {
          await logFocusSession({
            kind: finishedPhase,
            minutes: settings[finishedPhase] || DEFAULT_DURATIONS[finishedPhase],
            seconds: elapsed,
            completed,
            label: label.trim(),
          });
          load();
        } catch (err) {
          toast.error(err.response?.data?.error || 'Session could not be saved');
        }
      }

      const next =
        finishedPhase !== 'focus'
          ? 'focus'
          : nextCycles % LONG_BREAK_EVERY === 0
            ? 'long-break'
            : 'short-break';

      setPhase(next);
      setRemaining((settings[next] || DEFAULT_DURATIONS[next]) * 60);

      if (completed) {
        if (settings.sound && user?.notificationPrefs?.focusChime !== false) playChime();
        toast.success(
          finishedPhase === 'focus' ? 'Focus block done — take a break' : 'Break over — back to it'
        );
      }
    },
    [completedCycles, duration, label, load, settings, user]
  );

  const finishRef = useRef(finish);
  finishRef.current = finish;

  /* One interval per run, reading the deadline. Depending on `finish`
     directly would tear the interval down and rebuild it on every tick. */
  useEffect(() => {
    if (!running) return undefined;
    const tick = () => {
      const left = Math.round((deadlineRef.current - Date.now()) / 1000);
      if (left <= 0) {
        setRemaining(0);
        finishRef.current(true);
        return;
      }
      setRemaining(left);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running]);

  /* Keep the tab title counting down so the timer is legible from
     another tab — the single most-requested thing in a pomodoro app. */
  useEffect(() => {
    if (!running) return undefined;
    const phaseLabel = PHASES.find((p) => p.id === phase)?.label || 'Focus';
    document.title = `${fmt(remaining)} · ${phaseLabel} — SortLife`;
    return () => { document.title = 'Focus · SortLife'; };
  }, [running, remaining, phase]);

  const start = () => {
    deadlineRef.current = Date.now() + remaining * 1000;
    if (!startedAtRef.current) startedAtRef.current = Date.now() - (duration - remaining) * 1000;
    setRunning(true);
  };

  const pause = () => {
    setRunning(false);
    deadlineRef.current = null;
  };

  const reset = () => {
    setRunning(false);
    deadlineRef.current = null;
    startedAtRef.current = null;
    setRemaining(duration);
  };

  const switchPhase = (next) => {
    setRunning(false);
    deadlineRef.current = null;
    startedAtRef.current = null;
    setPhase(next);
    setRemaining((settings[next] || DEFAULT_DURATIONS[next]) * 60);
  };

  const removeSession = async (id) => {
    try {
      await deleteFocusSession(id);
      setData((prev) => ({ ...prev, sessions: prev.sessions.filter((s) => s._id !== id) }));
      toast.success('Session removed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not remove that');
    }
  };

  const ring = useMemo(() => {
    const circumference = 2 * Math.PI * 130;
    const progress = duration ? 1 - remaining / duration : 0;
    return { circumference, offset: circumference * (1 - progress) };
  }, [remaining, duration]);

  const stats = data?.stats;
  const peak = Math.max(1, ...(data?.daily || []).map((d) => d.minutes));

  return (
    <div className="focus-page page-enter">
      <header className="page-header">
        <div>
          <h1>{mode === 'run' ? 'Run' : 'Focus'}</h1>
          <p className="page-header-sub">
            {mode === 'run'
              ? 'Time your workout outside — it keeps counting even if you close the tab.'
              : `${LONG_BREAK_EVERY} blocks, then a long break. Nothing else on screen.`}
          </p>
        </div>
        {mode === 'focus' && (
        <div className="page-header-actions">
          <button
            type="button"
            className={`icon-btn ${settings.sound ? '' : 'is-active'}`}
            onClick={() => setSettings((s) => ({ ...s, sound: !s.sound }))}
            title={settings.sound ? 'Mute the end chime' : 'Unmute the end chime'}
            aria-label={settings.sound ? 'Mute the end chime' : 'Unmute the end chime'}
          >
            {settings.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button
            type="button"
            className={`icon-btn ${showSettings ? 'is-active' : ''}`}
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Timer lengths"
            aria-expanded={showSettings}
          >
            <Settings2 size={17} />
          </button>
        </div>
        )}
      </header>

      <div className="focus-mode-switch" role="tablist" aria-label="Mode">
        <button type="button" role="tab" aria-selected={mode === 'focus'} className={mode === 'focus' ? 'active' : ''} onClick={() => setMode('focus')}>
          <Brain size={15} /> Deep focus
        </button>
        <button type="button" role="tab" aria-selected={mode === 'run'} className={mode === 'run' ? 'active run' : ''} onClick={() => setMode('run')}>
          <Footprints size={15} /> Running
        </button>
      </div>

      {mode === 'run' ? (
        <RunTracker data={data} onChanged={load} />
      ) : (
      <div className="focus-layout">
        {/* ── Timer ────────────────────────────────────── */}
        <section className={`focus-timer phase-${phase} ${running ? 'is-running' : ''}`}>
          <div className="segmented focus-phases">
            {PHASES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={phase === p.id ? 'active' : ''}
                onClick={() => switchPhase(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="focus-dial" role="timer" aria-live="off">
            <svg viewBox="0 0 300 300">
              <circle className="focus-dial-track" cx="150" cy="150" r="130" />
              <circle
                className="focus-dial-fill"
                cx="150"
                cy="150"
                r="130"
                strokeDasharray={ring.circumference}
                strokeDashoffset={ring.offset}
              />
            </svg>
            <div className="focus-dial-copy">
              <strong>{fmt(remaining)}</strong>
              <span>{PHASES.find((p) => p.id === phase)?.label}</span>
              <div className="focus-pips" aria-label={`${completedCycles % LONG_BREAK_EVERY} of ${LONG_BREAK_EVERY} blocks this cycle`}>
                {Array.from({ length: LONG_BREAK_EVERY }, (_, i) => (
                  <i key={i} className={i < completedCycles % LONG_BREAK_EVERY ? 'on' : ''} />
                ))}
              </div>
            </div>
          </div>

          <input
            className="focus-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="What are you working on?"
            maxLength={200}
            aria-label="Session label"
          />

          <div className="focus-controls">
            <button type="button" className="icon-btn" onClick={reset} aria-label="Reset" title="Reset">
              <RotateCcw size={18} />
            </button>

            <button
              type="button"
              className="focus-play"
              onClick={running ? pause : start}
              aria-label={running ? 'Pause' : 'Start'}
            >
              {running ? <Pause size={26} /> : <Play size={26} style={{ marginLeft: 3 }} />}
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={() => finish(false)}
              aria-label="Skip to next phase"
              title="Skip"
            >
              <SkipForward size={18} />
            </button>
          </div>
        </section>

        {/* ── Stats ────────────────────────────────────── */}
        <div className="focus-side">
          {showSettings && (
            <section className="card card-pad focus-settings">
              <div className="section-head">
                <h2><Settings2 size={15} /> Lengths</h2>
              </div>
              {PHASES.map((p) => (
                <label key={p.id} className="focus-setting-row">
                  <span>{p.label}</span>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={settings[p.id]}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(240, Number(e.target.value) || 1));
                      setSettings((s) => ({ ...s, [p.id]: value }));
                      if (phase === p.id && !running) setRemaining(value * 60);
                    }}
                  />
                  <em>min</em>
                </label>
              ))}
            </section>
          )}

          <div className="stat-grid focus-stats">
            <div className="stat-card">
              <div className="stat-card-top">
                <span className="stat-card-label">Today</span>
                <span className="stat-card-icon"><Clock size={16} /></span>
              </div>
              <div className="stat-card-value">{stats?.todayMinutes ?? 0}m</div>
              <div className="stat-card-meta">{stats?.todaySessions ?? 0} sessions</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-top">
                <span className="stat-card-label">Streak</span>
                <span className="stat-card-icon"><Flame size={16} /></span>
              </div>
              <div className="stat-card-value">{stats?.streak ?? 0}</div>
              <div className="stat-card-meta">days in a row</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-top">
                <span className="stat-card-label">30 days</span>
                <span className="stat-card-icon"><Timer size={16} /></span>
              </div>
              <div className="stat-card-value">
                {Math.floor((stats?.totalMinutes ?? 0) / 60)}h
              </div>
              <div className="stat-card-meta">{stats?.totalMinutes ?? 0} minutes</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-top">
                <span className="stat-card-label">Completed</span>
                <span className="stat-card-icon"><CheckCircle2 size={16} /></span>
              </div>
              <div className="stat-card-value">{stats?.completedSessions ?? 0}</div>
              <div className="stat-card-meta">of {stats?.totalSessions ?? 0} started</div>
            </div>
          </div>

          <section className="card card-pad">
            <div className="section-head">
              <h2>Last 30 days</h2>
              <span className="section-head-sub">minutes per day</span>
            </div>
            <div className="focus-spark" role="img" aria-label="Focus minutes per day over the last 30 days">
              {(data?.daily || []).map((day) => (
                <span
                  key={day.date}
                  className={`focus-spark-bar ${day.minutes ? '' : 'is-empty'}`}
                  style={{ height: `${Math.max(4, (day.minutes / peak) * 100)}%` }}
                  title={`${day.date}: ${day.minutes} min`}
                />
              ))}
            </div>
          </section>

          <section className="card card-pad">
            <div className="section-head">
              <h2>Recent sessions</h2>
            </div>

            {loading ? (
              <div className="shimmer" style={{ height: 120, borderRadius: 'var(--radius-sm)' }} />
            ) : !data?.sessions?.length ? (
              <EmptyState
                icon={Timer}
                title="No sessions yet"
                description="Press play. Anything over 30 seconds gets recorded here."
              />
            ) : (
              <ul className="focus-log">
                {data.sessions.filter((s) => s.kind !== 'run').slice(0, 12).map((session) => (
                  <li key={session._id} className={session.completed ? 'is-complete' : ''}>
                    <span className={`focus-log-dot kind-${session.kind}`} />
                    <div className="grow">
                      <strong className="truncate">
                        {session.label || PHASES.find((p) => p.id === session.kind)?.label}
                      </strong>
                      <span>{format(new Date(session.startedAt), 'd MMM, HH:mm')}</span>
                    </div>
                    <span className="focus-log-min tabular">
                      {Math.round((session.seconds || 0) / 60)}m
                    </span>
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm icon-btn-danger"
                      onClick={() => removeSession(session._id)}
                      aria-label="Remove session"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      )}
    </div>
  );
}
