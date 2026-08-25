import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Sun, Flame, Target, Inbox, BookOpen, Timer, Check, ArrowRight,
  AlertTriangle, Sparkles, CalendarClock, Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getToday, toggleHabitDate, toggleInboxItem, toggleMilestone,
} from '../utils/api';
import EmptyState from '../components/EmptyState';
import { SkeletonRows } from '../components/Skeleton';
import './TodayPage.css';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/* One line that reacts to how the day is actually going, rather than a
   fixed motivational string that reads the same at 0% and 100%. */
function statusLine(progress, focusMinutes, openCount) {
  if (progress.habitsTotal === 0) return 'Add a habit and this page starts tracking your day.';
  if (progress.percent === 100) return 'Every habit checked. That is the whole day, done.';
  if (progress.percent >= 60) return `${progress.habitsTotal - progress.habitsDone} habit(s) left — you are nearly there.`;
  if (focusMinutes >= 25) return `${focusMinutes} minutes focused so far. Keep the run going.`;
  if (openCount > 8) return 'Your inbox is filling up. Clear a few before starting something new.';
  return 'Nothing is decided yet. Pick one thing and start.';
}

export default function TodayPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  const load = useCallback(async () => {
    try {
      const result = await getToday();
      setData(result);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load your day');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mark = (key, value) => setBusy((prev) => ({ ...prev, [key]: value }));

  const onToggleHabit = async (habit) => {
    if (busy[habit._id]) return;
    mark(habit._id, true);

    // Optimistic: the checkbox has to feel instant or nobody uses it.
    setData((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => (h._id === habit._id ? { ...h, done: !h.done } : h)),
      progress: {
        ...prev.progress,
        habitsDone: prev.progress.habitsDone + (habit.done ? -1 : 1),
        percent: Math.round(
          ((prev.progress.habitsDone + (habit.done ? -1 : 1)) / (prev.progress.habitsTotal || 1)) * 100
        ),
      },
    }));

    try {
      await toggleHabitDate(habit._id, todayStr());
      if (!habit.done) toast.success(`${habit.name} — done`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update that habit');
      load();
    } finally {
      mark(habit._id, false);
    }
  };

  const onToggleInbox = async (item) => {
    if (busy[item._id]) return;
    mark(item._id, true);
    setData((prev) => ({ ...prev, inbox: prev.inbox.filter((i) => i._id !== item._id) }));
    try {
      await toggleInboxItem(item._id);
      toast.success('Done');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update that');
      load();
    } finally {
      mark(item._id, false);
    }
  };

  const onToggleMilestone = async (milestone) => {
    const key = `${milestone.goalId}-${milestone._id}`;
    if (busy[key]) return;
    mark(key, true);
    setData((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((m) => m._id !== milestone._id),
    }));
    try {
      await toggleMilestone(milestone.goalId, milestone._id);
      toast.success('Milestone complete');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update that milestone');
      load();
    } finally {
      mark(key, false);
    }
  };

  const ring = useMemo(() => {
    const percent = data?.progress?.percent ?? 0;
    const circumference = 2 * Math.PI * 52;
    return { percent, circumference, offset: circumference * (1 - percent / 100) };
  }, [data?.progress?.percent]);

  if (loading) {
    return (
      <div className="today-page page-enter">
        <div className="today-hero shimmer" style={{ height: 178 }} />
        <SkeletonRows count={6} />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={Sun}
        title="Your day could not be loaded"
        description="Something went wrong reaching the server. Try again in a moment."
        actionLabel="Retry"
        onAction={load}
      />
    );
  }

  const { habits, milestones, inbox, reading, focus, progress, overdueGoals, dueToday } = data;
  const firstName = (user?.name || '').split(' ')[0];

  return (
    <div className="today-page page-enter">
      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="today-hero">
        <div className="today-hero-copy">
          <p className="today-date">
            <CalendarClock size={13} />
            {format(new Date(), 'EEEE, d MMMM')}
          </p>
          <h1>
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="today-status">
            {statusLine(progress, focus.minutes, inbox.length)}
          </p>

          <div className="today-hero-actions">
            <Link to="/focus" className="btn btn-primary">
              <Timer size={15} /> Start a focus block
            </Link>
            <Link to="/inbox" className="btn btn-secondary">
              <Inbox size={15} /> Inbox ({inbox.length})
            </Link>
          </div>
        </div>

        <div className="today-ring" role="img" aria-label={`${ring.percent}% of habits done`}>
          <svg viewBox="0 0 120 120">
            <circle className="today-ring-track" cx="60" cy="60" r="52" />
            <circle
              className="today-ring-fill"
              cx="60"
              cy="60"
              r="52"
              strokeDasharray={ring.circumference}
              strokeDashoffset={ring.offset}
            />
          </svg>
          <div className="today-ring-copy">
            <strong>{ring.percent}%</strong>
            <span>{progress.habitsDone}/{progress.habitsTotal} habits</span>
          </div>
        </div>
      </header>

      {/* ── Anything overdue gets its own alarm ──────────── */}
      {overdueGoals?.length > 0 && (
        <div className="today-alert">
          <AlertTriangle size={16} />
          <div>
            <strong>{overdueGoals.length} goal{overdueGoals.length === 1 ? '' : 's'} past their target date</strong>
            <span>{overdueGoals.map((g) => g.title).slice(0, 3).join(' · ')}</span>
          </div>
          <Link to="/goals" className="btn btn-sm btn-secondary">Review</Link>
        </div>
      )}

      <div className="today-grid">
        {/* ── Habits ─────────────────────────────────────── */}
        <section className="today-card">
          <div className="section-head">
            <h2><Flame size={16} /> Habits</h2>
            <Link to="/habits" className="section-head-sub">Manage</Link>
          </div>

          {habits.length === 0 ? (
            <EmptyState
              icon={Flame}
              title="No habits yet"
              description="Habits are the part of the day you do not have to decide about."
              actionLabel="Add your first"
              actionTo="/habits"
            />
          ) : (
            <ul className="today-list">
              {habits.map((habit) => (
                <li key={habit._id}>
                  <button
                    type="button"
                    className={`today-check ${habit.done ? 'done' : ''}`}
                    onClick={() => onToggleHabit(habit)}
                    disabled={busy[habit._id]}
                    aria-pressed={habit.done}
                  >
                    <span className="today-check-box"><Check size={13} /></span>
                    <span className="today-check-icon">{habit.icon || '✅'}</span>
                    <span className="today-check-label">{habit.name}</span>
                    {habit.streak > 0 && (
                      <span className="today-streak">
                        <Flame size={11} /> {habit.streak}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Next actions ───────────────────────────────── */}
        <section className="today-card">
          <div className="section-head">
            <h2><Target size={16} /> Next actions</h2>
            <Link to="/goals" className="section-head-sub">All goals</Link>
          </div>

          {milestones.length === 0 ? (
            <EmptyState
              icon={Target}
              title="Nothing scheduled this week"
              description="Give a milestone a due date and it will surface here."
              actionLabel="Open goals"
              actionTo="/goals"
            />
          ) : (
            <ul className="today-list">
              {milestones.map((ms) => (
                <li key={ms._id}>
                  <button
                    type="button"
                    className={`today-check ${ms.overdue ? 'is-overdue' : ''}`}
                    onClick={() => onToggleMilestone(ms)}
                    disabled={busy[`${ms.goalId}-${ms._id}`]}
                  >
                    <span className="today-check-box"><Check size={13} /></span>
                    <span className="today-check-label">
                      {ms.text}
                      <em>{ms.goalIcon} {ms.goalTitle}</em>
                    </span>
                    <span className={`today-due ${ms.overdue ? 'overdue' : ''}`}>
                      {format(new Date(ms.dueDate), 'd MMM')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Inbox ──────────────────────────────────────── */}
        <section className="today-card">
          <div className="section-head">
            <h2><Inbox size={16} /> Inbox</h2>
            <Link to="/inbox" className="section-head-sub">
              Open <ArrowRight size={11} />
            </Link>
          </div>

          {inbox.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Inbox zero"
              description="Nothing waiting to be sorted. Press C anywhere to capture something new."
            />
          ) : (
            <>
              {dueToday?.length > 0 && (
                <p className="today-note">
                  {dueToday.length} due today
                </p>
              )}
              <ul className="today-list">
                {inbox.slice(0, 8).map((item) => (
                  <li key={item._id}>
                    <button
                      type="button"
                      className={`today-check pri-${item.priority}`}
                      onClick={() => onToggleInbox(item)}
                      disabled={busy[item._id]}
                    >
                      <span className="today-check-box"><Check size={13} /></span>
                      <span className="today-check-label">{item.text}</span>
                      {item.priority === 'high' && <span className="today-flag">Urgent</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* ── Reading + focus ────────────────────────────── */}
        <section className="today-card">
          <div className="section-head">
            <h2><BookOpen size={16} /> Currently reading</h2>
            <Link to="/books" className="section-head-sub">Library</Link>
          </div>

          {reading.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No book in progress"
              description="Start one and its progress shows up right here."
              actionLabel="Add a book"
              actionTo="/books"
            />
          ) : (
            <ul className="today-reading">
              {reading.map((book) => {
                const percent = book.totalPages
                  ? Math.round((book.currentPage / book.totalPages) * 100)
                  : 0;
                return (
                  <li key={book._id}>
                    <div className="row-between">
                      <div className="grow">
                        <strong className="truncate">{book.title}</strong>
                        <span className="text-muted">{book.author}</span>
                      </div>
                      <span className="tabular text-muted">{percent}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="today-focus-strip">
            <div>
              <strong>{focus.minutes}m</strong>
              <span>focused today</span>
            </div>
            <div>
              <strong>{focus.sessions}</strong>
              <span>session{focus.sessions === 1 ? '' : 's'}</span>
            </div>
            <Link to="/focus" className="btn btn-soft btn-sm">
              <Plus size={13} /> Focus
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
