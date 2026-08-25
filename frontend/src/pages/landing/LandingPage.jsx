import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowRight, Menu, X, Flame, Target, BookOpen, Tv, LayoutDashboard,
  PenLine, StickyNote, Table, FolderKanban, Sparkles, Quote, Sun, Moon,
  Check, Inbox, Timer, BarChart3, Palette, Crown, Archive, Search,
  ChevronDown, Star, Shield, Zap, Download, Lock,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { THEMES } from '../../theme/catalog';
import './landing.css';

/* ─── Content ──────────────────────────────────────────── */

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Themes', href: '#themes' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const STATS = [
  { value: '12', label: 'tools in one place' },
  { value: '9', label: 'built-in themes' },
  { value: '0', label: 'to pay, ever' },
  { value: '100%', label: 'your data, exportable' },
];

/* The bento grid. `span` drives how many columns each card takes on
   desktop; on mobile everything collapses to one column anyway. */
const FEATURES = [
  {
    icon: Sun,
    title: 'My Day',
    body: 'One screen that answers "what should I be doing". Habits, due milestones, your inbox and what you are reading — checkable in place.',
    span: 2,
    accent: 'amber',
  },
  {
    icon: Inbox,
    title: 'Quick capture',
    body: 'Press C anywhere. Type the thought. Decide later whether it becomes a note, a goal or a habit.',
    span: 1,
    accent: 'indigo',
  },
  {
    icon: Timer,
    title: 'Focus timer',
    body: 'A pomodoro that survives a backgrounded tab, counts down in the tab title, and logs what you actually did.',
    span: 1,
    accent: 'teal',
  },
  {
    icon: Flame,
    title: 'Honest habits',
    body: 'You can only tick today. No backfilling last week to protect a streak — the number means something.',
    span: 1,
    accent: 'orange',
  },
  {
    icon: BarChart3,
    title: 'Insights that go somewhere',
    body: 'A habit heatmap, goal pace against the time actually elapsed, focus minutes over a year, and a weekly recap.',
    span: 2,
    accent: 'green',
  },
  {
    icon: PenLine,
    title: 'Notebook',
    body: 'Nested notebooks, rich blocks, images. Every book you read gets one automatically.',
    span: 1,
    accent: 'blue',
  },
  {
    icon: Target,
    title: 'Goal constellation',
    body: 'Milestones, sub-goals and a momentum score, so a year-long goal still shows movement this week.',
    span: 1,
    accent: 'violet',
  },
  {
    icon: Archive,
    title: 'Nothing is ever lost',
    body: 'Delete moves to trash for 30 days. Archive shelves without deleting. Restore puts it back exactly where it was.',
    span: 1,
    accent: 'slate',
  },
];

const SHOWCASE = [
  {
    id: 'today',
    label: 'My Day',
    icon: Sun,
    headline: 'Start where the day starts.',
    body: 'A progress ring for today\'s habits, the milestones actually due this week, and anything still sitting in your inbox — all tickable without leaving the page.',
    rows: [
      { icon: '🔥', text: 'Morning pages', meta: '12 day streak', done: true },
      { icon: '🏃', text: 'Run 5km', meta: '4 day streak', done: true },
      { icon: '📚', text: 'Read 20 pages', meta: '31 day streak', done: false },
      { icon: '🎯', text: 'Draft Q3 plan', meta: 'due today', done: false },
    ],
  },
  {
    id: 'habits',
    label: 'Habits',
    icon: Flame,
    headline: 'Streaks you can trust.',
    body: 'Only today can be marked. That single rule is what separates a streak that means something from a number you edited last night.',
    rows: [
      { icon: '💧', text: 'Drink 2L water', meta: '8 day streak', done: true },
      { icon: '🧘', text: 'Meditate', meta: '22 day streak', done: true },
      { icon: '📝', text: 'Journal', meta: '5 day streak', done: false },
      { icon: '🌙', text: 'Lights out by 11', meta: '3 day streak', done: false },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: BarChart3,
    headline: 'Proof, not vibes.',
    body: 'A year-long habit calendar, goal pace measured against the runway you actually have left, and a weekly recap that compares this week to last.',
    rows: [
      { icon: '📊', text: 'Habit consistency', meta: '82%', done: true },
      { icon: '⏱️', text: 'Focused this month', meta: '41h', done: true },
      { icon: '🏆', text: 'Longest streak', meta: '64 days', done: true },
      { icon: '🎯', text: 'Goals ahead of pace', meta: '5 of 7', done: true },
    ],
  },
  {
    id: 'notes',
    label: 'Notebook',
    icon: PenLine,
    headline: 'Somewhere to think.',
    body: 'Nested notebooks with rich blocks and images. Each book in your library gets a notebook of its own, so what you learned stays attached to where you learned it.',
    rows: [
      { icon: '📓', text: 'Atomic Habits', meta: '14 pages', done: true },
      { icon: '💡', text: 'Product ideas', meta: '6 pages', done: true },
      { icon: '🗂️', text: 'Meeting notes', meta: '23 pages', done: true },
      { icon: '✍️', text: 'Weekly review', meta: 'updated today', done: false },
    ],
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Dump everything in',
    body: 'Press C and type. Nothing needs a category, a project or a due date to be captured.',
    icon: Inbox,
  },
  {
    n: '02',
    title: 'Sort it when you feel like it',
    body: 'One click turns a captured line into a note, a goal, a habit or a sticky. Or leave it — the inbox is patient.',
    icon: Sparkles,
  },
  {
    n: '03',
    title: 'Let the numbers accumulate',
    body: 'Every check-in, focus block and finished page feeds the heatmaps. You do not have to do anything for that to happen.',
    icon: BarChart3,
  },
];

const TESTIMONIALS = [
  {
    quote: 'I have tried every productivity app there is. This is the first one where the habit streak actually means something, because it will not let me lie to it.',
    name: 'Priya R.',
    role: 'Product designer',
  },
  {
    quote: 'The focus timer keeps counting in the tab title. Sounds tiny. It is the reason I actually finish blocks instead of forgetting the timer exists.',
    name: 'Marcus T.',
    role: 'Software engineer',
  },
  {
    quote: 'Nine themes and I built a tenth. The whole app follows it — sidebar, charts, everything. No other tool I use gets that right.',
    name: 'Ana L.',
    role: 'Writer',
  },
  {
    quote: 'Everything exports to JSON in one click. I trust a tool more when it makes leaving easy, and then I never leave.',
    name: 'Devon K.',
    role: 'Data analyst',
  },
];

const PLANS = [
  {
    name: 'Common',
    price: 'Free',
    note: 'The whole app, no time limit.',
    features: [
      'Notes, goals, habits, books, shows, tables',
      'Quick capture, focus timer, My Day',
      'Insights, heatmaps & weekly recap',
      'Archive, trash & restore',
      'Full export — JSON and CSV',
      '3 themes',
    ],
  },
  {
    name: 'Premium',
    price: 'Free',
    note: 'Included for every verified account.',
    highlight: true,
    features: [
      'Everything in Common',
      'Shared projects & team invites',
      'Project chat and task assignment',
      'Priority in the roadmap queue',
      '3 themes',
    ],
  },
  {
    name: 'Platinum',
    price: 'Free',
    note: 'Granted per account. The appearance tier.',
    crown: true,
    features: [
      'Everything in Premium',
      'All 9 built-in themes',
      'Custom palette builder — 16 tokens',
      'Up to 12 saved palettes, synced',
      'Priority support',
    ],
  },
];

const FAQS = [
  {
    q: 'Is it really free?',
    a: 'Yes. Every plan costs nothing. There is no trial that expires and no feature that stops working. Platinum is granted per account rather than sold — it unlocks six extra themes and the palette builder, not your data.',
  },
  {
    q: 'What happens to my data if I leave?',
    a: 'You export it. One button gives you a single JSON file with every note, goal, habit, book, show, table, sticky, inbox item and focus session. Each collection also downloads as CSV. Nothing is held back on any plan.',
  },
  {
    q: 'Why can I only tick habits for today?',
    a: 'Because a streak you can edit is a number you made up. Backfilling is the single easiest way to make a habit tracker useless, so the server refuses any date that is not today.',
  },
  {
    q: 'Does the theme follow me between devices?',
    a: 'Yes. Your theme, density, text size and any custom palettes are saved to your account, not just the browser. Sign in anywhere and the app looks the way you left it.',
  },
  {
    q: 'Can I delete my account?',
    a: 'From Settings → Your data. It asks for your password and the word DELETE, then removes the account and everything attached to it. There is no retention period and no recovery — export first.',
  },
];

/* ─── Small pieces ─────────────────────────────────────── */

/** Fade-and-rise once, when the section first scrolls into view. */
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 22 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Counts up to a number the first time it is seen. */
function CountUp({ value }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const target = parseInt(value, 10);
    if (!inView || Number.isNaN(target) || target === 0) return undefined;

    const suffix = value.replace(/^\d+/, '');
    const started = performance.now();
    const duration = 900;
    let frame;

    const step = (now) => {
      const t = Math.min(1, (now - started) / duration);
      // Ease-out so the last digits settle rather than snap.
      const eased = 1 - (1 - t) ** 3;
      setDisplay(`${Math.round(target * eased)}${suffix}`);
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, value]);

  return <span ref={ref}>{display}</span>;
}

/* ─── Page ─────────────────────────────────────────────── */

export default function LandingPage() {
  const { isDark, toggleTheme, themeId, setTheme, preview, endPreview, canUse } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showcase, setShowcase] = useState('today');
  const [testimonial, setTestimonial] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* The mobile menu is a full-screen overlay; the page behind it must
     not scroll under the user's thumb. */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  useEffect(() => {
    const id = setInterval(() => setTestimonial((i) => (i + 1) % TESTIMONIALS.length), 6500);
    return () => clearInterval(id);
  }, []);

  const active = SHOWCASE.find((s) => s.id === showcase) || SHOWCASE[0];

  /* Hovering a swatch repaints the page for real — the fastest way to
     show what "nine themes" means is to just do it. Preview ignores the
     plan gate; only keeping a theme is gated, which is what the click
     handler below enforces. */
  const chooseTheme = useCallback((id) => {
    if (canUse(id)) {
      setTheme(id);
      return;
    }
    toast('Sign up for Platinum to keep this one — hover to try the rest.', {
      icon: '👑',
    });
  }, [canUse, setTheme]);

  return (
    <div className="lp">
      {/* ════ NAV ════════════════════════════════════════ */}
      <header className={`lp-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="lp-shell lp-nav-inner">
          <Link to="/" className="lp-logo" aria-label="SortLife home">
            <span className="lp-logo-mark"><Sparkles size={16} /></span>
            SortLife
          </Link>

          <nav className="lp-nav-links" aria-label="Sections">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </nav>

          <div className="lp-nav-actions">
            <button
              type="button"
              className="lp-icon-btn"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to a light theme' : 'Switch to a dark theme'}
            >
              {isDark ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <Link to="/login" className="lp-btn lp-btn-ghost">Sign in</Link>
            <Link to="/signup" className="lp-btn lp-btn-primary">
              Start free <ArrowRight size={15} />
            </Link>
            <button
              type="button"
              className="lp-menu-btn"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={21} />
            </button>
          </div>
        </div>
      </header>

      {/* ════ MOBILE MENU ═══════════════════════════════ */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="lp-mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="lp-mobile-head">
              <span className="lp-logo">
                <span className="lp-logo-mark"><Sparkles size={16} /></span>
                SortLife
              </span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X size={23} />
              </button>
            </div>

            <nav className="lp-mobile-links">
              {NAV_LINKS.map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.06 }}
                >
                  {link.label}
                  <ArrowRight size={17} />
                </motion.a>
              ))}
            </nav>

            <div className="lp-mobile-actions">
              <Link to="/login" className="lp-btn lp-btn-ghost lp-btn-block">Sign in</Link>
              <Link to="/signup" className="lp-btn lp-btn-primary lp-btn-block">
                Start free <ArrowRight size={15} />
              </Link>
              <button
                type="button"
                className="lp-mobile-theme"
                onClick={toggleTheme}
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
                Switch to {isDark ? 'light' : 'dark'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ HERO ══════════════════════════════════════ */}
      <section className="lp-hero">
        <div className="lp-hero-glow" aria-hidden />
        <div className="lp-hero-grid" aria-hidden />

        <div className="lp-shell lp-hero-inner">
          <motion.a
            href="#themes"
            className="lp-pill"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="lp-pill-dot" />
            Nine themes, and one you build yourself
            <ArrowRight size={13} />
          </motion.a>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.06 }}
          >
            Your whole life,
            <span className="lp-h1-accent"> finally sorted.</span>
          </motion.h1>

          <motion.p
            className="lp-hero-sub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
          >
            Notes, goals, habits, books, shows, projects and money — in one
            workspace that looks the way you want it to. Free forever, exports
            in one click, and it will not let you fake a streak.
          </motion.p>

          <motion.div
            className="lp-hero-cta"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
          >
            <Link to="/signup" className="lp-btn lp-btn-primary lp-btn-lg">
              Create your workspace <ArrowRight size={17} />
            </Link>
            <a href="#showcase" className="lp-btn lp-btn-outline lp-btn-lg">
              See it in action
            </a>
          </motion.div>

          <motion.div
            className="lp-hero-trust"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.26 }}
          >
            <span><Check size={13} /> No credit card</span>
            <span><Download size={13} /> Export anytime</span>
            <span><Shield size={13} /> Your data stays yours</span>
          </motion.div>

          {/* ── Product mock ────────────────────────────── */}
          <motion.div
            className="lp-mock-wrap"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="lp-mock">
              <div className="lp-mock-bar">
                <span className="lp-mock-dots"><i /><i /><i /></span>
                <span className="lp-mock-url"><Search size={11} /> sortlife.com/today</span>
              </div>

              <div className="lp-mock-body">
                <aside className="lp-mock-side">
                  <span className="lp-mock-brand"><Sparkles size={12} /> SortLife</span>
                  {[
                    [Sun, 'My Day', true],
                    [LayoutDashboard, 'Dashboard', false],
                    [Inbox, 'Inbox', false],
                    [Timer, 'Focus', false],
                    [PenLine, 'Notebook', false],
                    [Flame, 'Habits', false],
                    [Target, 'Goals', false],
                    [BarChart3, 'Insights', false],
                  ].map(([Icon, label, on]) => (
                    <span key={label} className={`lp-mock-nav ${on ? 'on' : ''}`}>
                      <Icon size={12} /> {label}
                    </span>
                  ))}
                </aside>

                <main className="lp-mock-main">
                  <div className="lp-mock-hero">
                    <div>
                      <span className="lp-mock-eyebrow">Tuesday, 14 May</span>
                      <h3>Good morning, Sam</h3>
                      <p>3 habits left — you are nearly there.</p>
                    </div>
                    <div className="lp-mock-ring">
                      <svg viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="33" className="lp-ring-track" />
                        <circle cx="40" cy="40" r="33" className="lp-ring-fill" />
                      </svg>
                      <b>62%</b>
                    </div>
                  </div>

                  <div className="lp-mock-cards">
                    {[
                      { icon: '🔥', label: 'Morning pages', done: true },
                      { icon: '🏃', label: 'Run 5km', done: true },
                      { icon: '📚', label: 'Read 20 pages', done: false },
                    ].map((row) => (
                      <span key={row.label} className={`lp-mock-row ${row.done ? 'done' : ''}`}>
                        <i>{row.done ? <Check size={10} /> : null}</i>
                        {row.icon} {row.label}
                      </span>
                    ))}
                  </div>

                  <div className="lp-mock-chart" aria-hidden>
                    {[38, 62, 45, 78, 90, 55, 84, 96, 70, 88, 60, 92].map((h, i) => (
                      <span key={i} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </main>
              </div>
            </div>

            {/* Cards that drift beside the window, hinting at the rest. */}
            <motion.div
              className="lp-float lp-float-1"
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Flame size={15} />
              <div><strong>64 days</strong><span>longest streak</span></div>
            </motion.div>

            <motion.div
              className="lp-float lp-float-2"
              animate={{ y: [0, 14, 0] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            >
              <Timer size={15} />
              <div><strong>41 hours</strong><span>focused this month</span></div>
            </motion.div>

            <motion.div
              className="lp-float lp-float-3"
              animate={{ y: [0, -9, 0] }}
              transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
            >
              <Palette size={15} />
              <div><strong>9 themes</strong><span>+ your own</span></div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ════ STATS ═════════════════════════════════════ */}
      <section className="lp-stats">
        <div className="lp-shell lp-stats-inner">
          {STATS.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 0.07} className="lp-stat">
              <strong><CountUp value={stat.value} /></strong>
              <span>{stat.label}</span>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ════ FEATURES ══════════════════════════════════ */}
      <section className="lp-section" id="features">
        <div className="lp-shell">
          <Reveal className="lp-head">
            <span className="lp-eyebrow"><Zap size={12} /> Features</span>
            <h2>Twelve tools that stopped being twelve tabs.</h2>
            <p>
              Everything shares one search, one theme and one export. Nothing here
              needs a second app to be useful.
            </p>
          </Reveal>

          <div className="lp-bento">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Reveal key={feature.title} delay={(i % 3) * 0.06} className={`lp-bento-cell span-${feature.span}`}>
                  <article className={`lp-card accent-${feature.accent}`}>
                    <span className="lp-card-icon"><Icon size={19} /></span>
                    <h3>{feature.title}</h3>
                    <p>{feature.body}</p>
                    <span className="lp-card-glow" aria-hidden />
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════ SHOWCASE ══════════════════════════════════ */}
      <section className="lp-section lp-section-alt" id="showcase">
        <div className="lp-shell">
          <Reveal className="lp-head">
            <span className="lp-eyebrow"><LayoutDashboard size={12} /> A closer look</span>
            <h2>Pick a screen. See what it actually does.</h2>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="lp-tabs" role="tablist">
              {SHOWCASE.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={showcase === item.id}
                    className={`lp-tab ${showcase === item.id ? 'active' : ''}`}
                    onClick={() => setShowcase(item.id)}
                  >
                    <Icon size={15} /> {item.label}
                  </button>
                );
              })}
            </div>
          </Reveal>

          <div className="lp-showcase">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                className="lp-showcase-copy"
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                transition={{ duration: 0.3 }}
              >
                <h3>{active.headline}</h3>
                <p>{active.body}</p>
                <Link to="/signup" className="lp-btn lp-btn-primary">
                  Try it free <ArrowRight size={15} />
                </Link>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${active.id}-panel`}
                className="lp-showcase-panel"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.32 }}
              >
                <div className="lp-panel-head">
                  <active.icon size={14} />
                  {active.label}
                </div>
                {active.rows.map((row, i) => (
                  <motion.div
                    key={row.text}
                    className={`lp-panel-row ${row.done ? 'done' : ''}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + i * 0.07 }}
                  >
                    <span className="lp-panel-check">{row.done && <Check size={11} />}</span>
                    <span className="lp-panel-icon">{row.icon}</span>
                    <span className="lp-panel-text">{row.text}</span>
                    <span className="lp-panel-meta">{row.meta}</span>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ════ THEMES ════════════════════════════════════ */}
      <section className="lp-section" id="themes">
        <div className="lp-shell">
          <Reveal className="lp-head">
            <span className="lp-eyebrow"><Palette size={12} /> Appearance</span>
            <h2>Hover a theme. The whole page changes.</h2>
            <p>
              Not a preview image — the real thing. Every theme repaints the entire
              app, charts and sidebar included. Three are free; the rest come with
              Platinum, along with a builder for palettes of your own.
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="lp-themes" onMouseLeave={endPreview}>
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className={`lp-theme ${themeId === theme.id ? 'active' : ''}`}
                  onMouseEnter={() => preview(theme.id)}
                  onFocus={() => preview(theme.id)}
                  onBlur={endPreview}
                  onClick={() => chooseTheme(theme.id)}
                >
                  <span className="lp-theme-strip">
                    {theme.swatch.map((color, i) => (
                      <i key={i} style={{ background: color }} />
                    ))}
                  </span>
                  <strong>{theme.label}</strong>
                  <span className="lp-theme-tier">
                    {theme.tier === 'free'
                      ? 'Free'
                      : <><Crown size={9} /> Platinum</>}
                  </span>
                </button>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.14}>
            <div className="lp-theme-note">
              <Lock size={14} />
              Platinum themes preview here for everyone — signing in is what saves them.
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════ HOW IT WORKS ══════════════════════════════ */}
      <section className="lp-section lp-section-alt">
        <div className="lp-shell">
          <Reveal className="lp-head">
            <span className="lp-eyebrow"><Sparkles size={12} /> How it works</span>
            <h2>Three steps, and none of them is "set up your system".</h2>
          </Reveal>

          <div className="lp-steps">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.n} delay={i * 0.1} className="lp-step">
                  <span className="lp-step-n">{step.n}</span>
                  <span className="lp-step-icon"><Icon size={20} /></span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════ TESTIMONIALS ══════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-shell">
          <Reveal className="lp-head">
            <span className="lp-eyebrow"><Star size={12} /> People using it</span>
            <h2>What actually made them stay.</h2>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="lp-quote-wrap">
              <AnimatePresence mode="wait">
                <motion.blockquote
                  key={testimonial}
                  className="lp-quote"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.35 }}
                >
                  <Quote size={26} className="lp-quote-mark" />
                  <p>{TESTIMONIALS[testimonial].quote}</p>
                  <footer>
                    <span className="lp-quote-avatar">
                      {TESTIMONIALS[testimonial].name[0]}
                    </span>
                    <span>
                      <strong>{TESTIMONIALS[testimonial].name}</strong>
                      <em>{TESTIMONIALS[testimonial].role}</em>
                    </span>
                  </footer>
                </motion.blockquote>
              </AnimatePresence>

              <div className="lp-quote-dots">
                {TESTIMONIALS.map((t, i) => (
                  <button
                    key={t.name}
                    type="button"
                    className={i === testimonial ? 'active' : ''}
                    onClick={() => setTestimonial(i)}
                    aria-label={`Show quote from ${t.name}`}
                  />
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════ PRICING ═══════════════════════════════════ */}
      <section className="lp-section lp-section-alt" id="pricing">
        <div className="lp-shell">
          <Reveal className="lp-head">
            <span className="lp-eyebrow"><Crown size={12} /> Pricing</span>
            <h2>Every plan is free. They differ in how it looks.</h2>
            <p>
              Nothing about your data is behind a plan — export, archive and restore
              work everywhere. Platinum buys you themes, not access.
            </p>
          </Reveal>

          <div className="lp-plans">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 0.08}>
                <article className={`lp-plan ${plan.highlight ? 'is-featured' : ''} ${plan.crown ? 'is-platinum' : ''}`}>
                  {plan.highlight && <span className="lp-plan-tag">Most people</span>}
                  {plan.crown && <span className="lp-plan-tag is-gold"><Crown size={10} /> Best looking</span>}

                  <h3>{plan.name}</h3>
                  <div className="lp-plan-price">{plan.price}</div>
                  <p className="lp-plan-note">{plan.note}</p>

                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}><Check size={14} /> {feature}</li>
                    ))}
                  </ul>

                  <Link
                    to="/signup"
                    className={`lp-btn lp-btn-block ${plan.highlight || plan.crown ? 'lp-btn-primary' : 'lp-btn-outline'}`}
                  >
                    Get started
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════ FAQ ═══════════════════════════════════════ */}
      <section className="lp-section" id="faq">
        <div className="lp-shell lp-shell-narrow">
          <Reveal className="lp-head">
            <span className="lp-eyebrow">FAQ</span>
            <h2>The questions people actually ask.</h2>
          </Reveal>

          <div className="lp-faq">
            {FAQS.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 0.05}>
                <div className={`lp-faq-item ${openFaq === i ? 'open' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                    aria-expanded={openFaq === i}
                  >
                    {faq.q}
                    <ChevronDown size={17} />
                  </button>
                  <div className="lp-faq-answer">
                    <p>{faq.a}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════ CTA ═══════════════════════════════════════ */}
      <section className="lp-cta">
        <div className="lp-shell">
          <Reveal className="lp-cta-inner">
            <span className="lp-cta-glow" aria-hidden />
            <h2>Sorted takes about five minutes.</h2>
            <p>
              Sign up, dump everything into the inbox, and let the app work out what
              it is. No onboarding tour, no template gallery.
            </p>
            <div className="lp-cta-actions">
              <Link to="/signup" className="lp-btn lp-btn-invert lp-btn-lg">
                Create your workspace <ArrowRight size={17} />
              </Link>
              <Link to="/login" className="lp-btn lp-btn-ghost-invert lp-btn-lg">
                I already have one
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════ FOOTER ════════════════════════════════════ */}
      <footer className="lp-footer">
        <div className="lp-shell lp-footer-inner">
          <div className="lp-footer-brand">
            <Link to="/" className="lp-logo">
              <span className="lp-logo-mark"><Sparkles size={16} /></span>
              SortLife
            </Link>
            <p>Notes, goals, habits, books, shows, projects and money — sorted.</p>
          </div>

          <div className="lp-footer-cols">
            <div>
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#showcase">Screens</a>
              <a href="#themes">Themes</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div>
              <h4>Inside</h4>
              <span><PenLine size={12} /> Notebook</span>
              <span><Flame size={12} /> Habits</span>
              <span><Target size={12} /> Goals</span>
              <span><FolderKanban size={12} /> Projects</span>
            </div>
            <div>
              <h4>Library</h4>
              <span><BookOpen size={12} /> Books</span>
              <span><Tv size={12} /> Shows</span>
              <span><Table size={12} /> Tables</span>
              <span><StickyNote size={12} /> Stickies</span>
            </div>
            <div>
              <h4>Account</h4>
              <Link to="/signup">Create one</Link>
              <Link to="/login">Sign in</Link>
              <a href="#faq">FAQ</a>
            </div>
          </div>
        </div>

        <div className="lp-shell lp-footer-bottom">
          <span>© {new Date().getFullYear()} SortLife. Free forever.</span>
          <span className="lp-footer-made">Built for people with too many tabs.</span>
        </div>
      </footer>
    </div>
  );
}
