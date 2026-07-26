import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  ArrowRight, Menu, X, Check, Flame, Target, BookOpen, Tv,
  LayoutDashboard, PenLine, StickyNote, Table, FolderKanban,
  Zap, Star, Sparkles, Quote, ChevronLeft, ChevronRight,
  CheckCircle2, Circle, Palette,
} from 'lucide-react';
import { useTheme, NOVA_THEMES } from '../../context/ThemeContext';
import './landing.css';

/* ─── Re-export for AuthPage backward compat ────────────── */
export { NOVA_THEMES };

/* ─── Nav links (no Pricing) ────────────────────────────── */
const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Demo',     href: '#demo' },
  { label: 'Reviews',  href: '#testimonials' },
];

/* ─── Sidebar items ─────────────────────────────────────── */
const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',    group: 'WORKSPACE' },
  { icon: PenLine,         label: 'Notebook',     group: 'WORKSPACE' },
  { icon: StickyNote,      label: 'Sticky Notes', group: 'WORKSPACE' },
  { icon: Target,          label: 'Goals',        group: 'PRODUCTIVITY' },
  { icon: Flame,           label: 'Habits',       group: 'PRODUCTIVITY' },
  { icon: BookOpen,        label: 'Books',        group: 'LIBRARY' },
  { icon: Tv,              label: 'Shows',        group: 'LIBRARY' },
  { icon: Table,           label: 'Tables',       group: 'DATA' },
];

/* ─── Features ──────────────────────────────────────────── */
const FEATURES = [
  { icon: PenLine,      title: 'Notebook',      body: 'Rich blocks, images, nested notebooks — capture thoughts that stay connected.' },
  { icon: StickyNote,   title: 'Sticky Notes',  body: 'Floating, colour-coded notes that sit on your screen wherever you need them.' },
  { icon: Flame,        title: 'Habit Tracker', body: 'Mark only today. Build streaks the honest way, with animated progress rings.' },
  { icon: Target,       title: 'Goals',         body: 'North-star goals, nested milestones, momentum bars and earned achievements.' },
  { icon: Table,        title: 'Custom Tables', body: 'Spreadsheet-style boards with typed columns, dropdown filters, inline editing.' },
  { icon: BookOpen,     title: 'Books',         body: 'Track reading progress with cover art, page counts and linked learning notes.' },
  { icon: Tv,           title: 'Shows',         body: 'Log movies and series with season tracking, ratings and poster art.' },
  { icon: FolderKanban, title: 'Projects',      body: 'Kanban tasks, team invites and threaded chat — visible only when you build.' },
];

/* ─── Testimonials ──────────────────────────────────────── */
const TESTIMONIALS = [
  { name: 'Ayesha K.', role: 'Student',        stars: 5, text: 'The habit tracker changed my daily routine completely. The streak animations actually motivate me to keep going.' },
  { name: 'Omar R.',   role: 'Freelancer',      stars: 5, text: 'Sticky notes visible while I work, tables for clients, goals for the year — it replaced four apps in one shot.' },
  { name: 'Sarah M.',  role: 'Product Manager', stars: 5, text: 'Dark mode, warm colours, and everything in one sidebar. I genuinely look forward to opening it each morning.' },
  { name: 'James L.',  role: 'Developer',       stars: 5, text: 'The Projects module with kanban and chat is exactly what I needed. Smart enough to stay hidden until you need it.' },
  { name: 'Priya N.',  role: 'Writer',          stars: 5, text: 'The notebook block editor rivals Notion. Goals with nested milestones keep my whole book project on track.' },
  { name: 'Khalid S.', role: 'Entrepreneur',    stars: 5, text: 'Best all-in-one tool I have found. The goals + habits combination keeps me accountable every single day.' },
];

/* ─── Demo data ─────────────────────────────────────────── */
const DEMO_TABS = [
  { id: 'habits',   label: 'Habits',   icon: Flame },
  { id: 'goals',    label: 'Goals',    icon: Target },
  { id: 'library',  label: 'Library',  icon: BookOpen },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
];

const DEMO_HABITS = [
  { name: 'Morning Run',    icon: '🏃', streak: 12, done: true,  days: [1,1,1,1,1,1,1] },
  { name: 'Read 30 min',    icon: '📚', streak: 8,  done: true,  days: [1,1,0,1,1,1,1] },
  { name: 'Meditate',       icon: '🧘', streak: 21, done: false, days: [1,1,1,1,1,1,0] },
  { name: 'Drink 8 Glasses',icon: '💧', streak: 5,  done: true,  days: [0,1,1,1,0,1,1] },
];

const DEMO_GOALS = [
  { title: 'Ship SortLife v2',   icon: '🚀', progress: 72, category: 'work',     milestones: ['Design system', 'Auth', 'Demo page'],   doneMs: [true, true, false] },
  { title: 'Read 24 books',      icon: '📚', progress: 50, category: 'learning', milestones: ['Q1 books (6)', 'Q2 books (6)'],          doneMs: [true, false] },
  { title: 'Run a half-marathon',icon: '🏃', progress: 35, category: 'health',   milestones: ['10k comfortable', '15k run'],            doneMs: [true, false] },
];

const DEMO_BOOKS = [
  { title: 'Atomic Habits',       author: 'James Clear',      page: 180, total: 320, status: 'reading',        cover: '📗' },
  { title: 'Deep Work',           author: 'Cal Newport',       page: 320, total: 320, status: 'completed',      cover: '📘' },
  { title: 'The Lean Startup',    author: 'Eric Ries',          page: 0,   total: 290, status: 'want-to-read',  cover: '📙' },
];

const DEMO_PROJECT = {
  title: 'SortLife Dashboard Redesign',
  priority: 'high',
  progress: 68,
  tasks: [
    { text: 'Dark theme CSS tokens',      done: true },
    { text: 'Hero section + animations',  done: true },
    { text: 'Interactive demo component', done: true },
    { text: 'Floating testimonials',      done: false },
    { text: 'Theme switcher dropdown',    done: false },
  ],
};

/* ─── Orb ───────────────────────────────────────────────── */
function Orb({ style, cls = '' }) {
  return (
    <motion.div
      className={`nova-orb ${cls}`} style={style} aria-hidden
      animate={{ scale: [1, 1.14, 1], opacity: [0.3, 0.5, 0.3] }}
      transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

/* ─── Theme picker ──────────────────────────────────────── */
function ThemePicker({ current, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="nova-theme-picker" ref={ref}>
      <button
        type="button"
        className="nova-theme-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change theme"
        title="Change theme"
      >
        <Palette size={15} />
        <span>{current.label}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="nova-theme-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
          >
            {NOVA_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`nova-theme-option ${current.id === t.id ? 'active' : ''}`}
                onClick={() => { onChange(t); setOpen(false); }}
              >
                <span className="nova-theme-swatch" style={{ background: `linear-gradient(135deg,${t.a1},${t.a2})` }} />
                <span>{t.label}</span>
                {current.id === t.id && <Check size={12} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Sidebar mockup ─────────────────────────────────────── */
function SidebarMockup({ activeIdx = 0 }) {
  const groups = ['WORKSPACE', 'PRODUCTIVITY', 'LIBRARY', 'DATA'];
  const byGroup = groups.reduce((acc, g) => {
    acc[g] = SIDEBAR_ITEMS.filter((i) => i.group === g);
    return acc;
  }, {});
  return (
    <motion.div className="nova-sidebar-mock" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.2 }}>
      <div className="nova-sidebar-mock-logo"><Zap size={14} /><span>SortLife</span></div>
      {groups.map((group, gi) => (
        <div key={group} className="nova-sidebar-mock-group">
          <motion.p className="nova-sidebar-mock-grouplabel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 + gi * 0.08 }}>{group}</motion.p>
          {byGroup[group].map(({ icon: Icon, label }) => {
            const idx = SIDEBAR_ITEMS.findIndex((s) => s.label === label);
            return (
              <motion.div
                key={label}
                className={`nova-sidebar-mock-item ${idx === activeIdx ? 'active' : ''}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.48 + idx * 0.07, type: 'spring', stiffness: 320, damping: 22 }}
              >
                <Icon size={12} /><span>{label}</span>
              </motion.div>
            );
          })}
        </div>
      ))}
    </motion.div>
  );
}

/* ─── Demo panels ────────────────────────────────────────── */
function HabitsDemo() {
  const [checked, setChecked] = useState({ 0: true, 1: true, 3: true });
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div className="demo-panel">
      <div className="demo-panel-head"><Flame size={14} /><span>Habit Tracker</span><span className="demo-hint">Only today is editable</span></div>
      <div className="demo-habits-table">
        <div className="demo-habits-header">
          <div className="demo-habit-namecol">Habit</div>
          {days.map((d, i) => <div key={i} className={`demo-habit-daycol ${i === 6 ? 'today' : ''}`}>{d}</div>)}
          <div className="demo-habit-streak">🔥</div>
        </div>
        {DEMO_HABITS.map((h, hi) => (
          <motion.div
            key={h.name}
            className="demo-habit-row"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: hi * 0.08 }}
          >
            <div className="demo-habit-namecol">
              <span className="demo-habit-icon">{h.icon}</span>
              <span className="demo-habit-name">{h.name}</span>
            </div>
            {h.days.map((done, di) => (
              <div key={di} className="demo-habit-daycol">
                {di === 6 ? (
                  <button
                    className={`demo-dot ${checked[hi] ? 'done' : ''}`}
                    onClick={() => setChecked((p) => ({ ...p, [hi]: !p[hi] }))}
                  >
                    {checked[hi] ? '✓' : ''}
                  </button>
                ) : (
                  <div className={`demo-dot static ${done ? 'done' : ''}`}>{done ? '✓' : ''}</div>
                )}
              </div>
            ))}
            <div className="demo-habit-streak">{h.streak}d</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function GoalsDemo() {
  const [expanded, setExpanded] = useState(0);
  const catColor = { work: '#F5A623', learning: '#22D3EE', health: '#4ADE80' };
  return (
    <div className="demo-panel">
      <div className="demo-panel-head"><Target size={14} /><span>Goal Constellation</span></div>
      <div className="demo-goals-list">
        {DEMO_GOALS.map((g, gi) => {
          const color = catColor[g.category] || '#F5A623';
          const circ = 2 * Math.PI * 14;
          return (
            <motion.div
              key={g.title}
              className={`demo-goal-card ${expanded === gi ? 'open' : ''}`}
              style={{ '--gc': color }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.1 }}
            >
              <button className="demo-goal-top" onClick={() => setExpanded(expanded === gi ? -1 : gi)}>
                <span className="demo-goal-icon">{g.icon}</span>
                <div className="demo-goal-info">
                  <strong>{g.title}</strong>
                  <span className="demo-goal-cat">{g.category}</span>
                </div>
                <svg className="demo-goal-ring" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                  <motion.circle
                    cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="3"
                    strokeLinecap="round" strokeDasharray={`${circ}`}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: circ - (g.progress / 100) * circ }}
                    transition={{ duration: 1, delay: gi * 0.15, ease: 'easeOut' }}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                  />
                </svg>
                <span className="demo-goal-pct">{g.progress}%</span>
              </button>
              <AnimatePresence>
                {expanded === gi && (
                  <motion.div
                    className="demo-goal-milestones"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                  >
                    {g.milestones.map((ms, mi) => (
                      <div key={ms} className={`demo-ms-item ${g.doneMs[mi] ? 'done' : ''}`}>
                        {g.doneMs[mi] ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                        <span>{ms}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function LibraryDemo() {
  const statusColors = { reading: '#F5A623', completed: '#4ADE80', 'want-to-read': '#7B7B7B' };
  return (
    <div className="demo-panel">
      <div className="demo-panel-head"><BookOpen size={14} /><span>Books Library</span></div>
      <div className="demo-books-list">
        {DEMO_BOOKS.map((b, bi) => {
          const pct = b.total > 0 ? Math.round((b.page / b.total) * 100) : 0;
          const col = statusColors[b.status] || '#7B7B7B';
          return (
            <motion.div key={b.title} className="demo-book-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: bi * 0.1 }}>
              <div className="demo-book-cover">{b.cover}</div>
              <div className="demo-book-info">
                <strong>{b.title}</strong>
                <span className="demo-book-author">{b.author}</span>
                <div className="demo-book-bar">
                  <div className="demo-book-bar-fill" style={{ width: `${pct}%`, background: col }} />
                </div>
                <div className="demo-book-meta">
                  <span className="demo-status-dot" style={{ background: col }} />
                  <span style={{ color: col }}>{b.status.replace(/-/g, ' ')}</span>
                  {b.status === 'reading' && <span style={{ color: 'var(--nova-dim)' }}>p.{b.page}/{b.total}</span>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectsDemo() {
  const p = DEMO_PROJECT;
  const circ = 2 * Math.PI * 26;
  return (
    <div className="demo-panel">
      <div className="demo-panel-head"><FolderKanban size={14} /><span>Projects</span></div>
      <div className="demo-project-card">
        <div className="demo-project-top">
          <div>
            <strong className="demo-project-title">{p.title}</strong>
            <span className="demo-priority-badge high">HIGH</span>
          </div>
          <div className="demo-project-ring-wrap">
            <svg viewBox="0 0 60 60" className="demo-project-ring">
              <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              <motion.circle
                cx="30" cy="30" r="26" fill="none"
                stroke="var(--nova-amber)" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${circ}`}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: circ - (p.progress / 100) * circ }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
              />
            </svg>
            <span className="demo-project-pct">{p.progress}%</span>
          </div>
        </div>
        <div className="demo-project-tasks">
          {p.tasks.map((t, ti) => (
            <motion.div
              key={t.text}
              className={`demo-task-item ${t.done ? 'done' : ''}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: ti * 0.09 }}
            >
              {t.done ? <CheckCircle2 size={13} /> : <Circle size={13} />}
              <span>{t.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Full interactive demo ──────────────────────────────── */
const DEMO_SIDEBAR_IDX = { habits: 4, goals: 3, library: 5, projects: 0 };

function InteractiveDemo() {
  const [tab, setTab] = useState('habits');
  const panels = { habits: <HabitsDemo />, goals: <GoalsDemo />, library: <LibraryDemo />, projects: <ProjectsDemo /> };

  return (
    <div className="nova-idemo">
      <SidebarMockup activeIdx={DEMO_SIDEBAR_IDX[tab]} />
      <div className="nova-idemo-main">
        <div className="nova-mock-chrome">
          <div className="nova-mock-dots">
            <span style={{ background: '#ff5f57' }} />
            <span style={{ background: '#febc2e' }} />
            <span style={{ background: '#28c840' }} />
          </div>
          <div className="nova-mock-url">sortlife.app — {tab.charAt(0).toUpperCase() + tab.slice(1)}</div>
        </div>
        <div className="nova-idemo-tabs">
          {DEMO_TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`nova-idemo-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="nova-idemo-content"
          >
            {panels[tab]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Feature card ───────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, body, index }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  return (
    <motion.article
      ref={ref}
      className="nova-feature-card"
      initial={{ opacity: 0, y: 26 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.06, duration: 0.42 }}
      whileHover={{ y: -6 }}
    >
      <div className="nova-feature-icon"><Icon size={20} strokeWidth={1.75} /></div>
      <h3>{title}</h3>
      <p>{body}</p>
    </motion.article>
  );
}

/* ─── Floating testimonials carousel ────────────────────── */
function TestimonialsCarousel() {
  const [idx, setIdx] = useState(0);
  const total = TESTIMONIALS.length;

  // Auto-advance
  useEffect(() => {
    const id = setInterval(() => setIdx((v) => (v + 1) % total), 4000);
    return () => clearInterval(id);
  }, [total]);

  const prev = () => setIdx((v) => (v - 1 + total) % total);
  const next = () => setIdx((v) => (v + 1) % total);

  // Show 3 visible cards: prev, current, next
  const visible = [-1, 0, 1].map((offset) => {
    const i = (idx + offset + total) % total;
    return { ...TESTIMONIALS[i], offset, key: `${i}-${offset}` };
  });

  return (
    <div className="nova-testi-carousel-wrap">
      <div className="nova-testi-float-row">
        {visible.map(({ name, role, stars, text, offset, key }) => (
          <motion.blockquote
            key={key}
            className={`nova-testi-float ${offset === 0 ? 'center' : 'side'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{
              opacity: offset === 0 ? 1 : 0.45,
              y: 0,
              scale: offset === 0 ? 1 : 0.88,
              filter: offset === 0 ? 'blur(0px)' : 'blur(1.5px)',
            }}
            transition={{ duration: 0.35 }}
            layout
          >
            <div className="nova-testi-stars">
              {Array.from({ length: stars }).map((_, i) => <Star key={i} size={12} fill="var(--nova-amber)" color="var(--nova-amber)" />)}
            </div>
            <Quote size={18} className="nova-testi-quote-icon" />
            <p>"{text}"</p>
            <footer>
              <strong>{name}</strong>
              <span>{role}</span>
            </footer>
          </motion.blockquote>
        ))}
      </div>
      <div className="nova-testi-controls">
        <button type="button" className="nova-testi-arrow" onClick={prev} aria-label="Previous"><ChevronLeft size={18} /></button>
        <div className="nova-testi-dots">
          {TESTIMONIALS.map((_, i) => (
            <button key={i} type="button" className={`nova-testi-dot ${i === idx ? 'active' : ''}`} onClick={() => setIdx(i)} />
          ))}
        </div>
        <button type="button" className="nova-testi-arrow" onClick={next} aria-label="Next"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

/* ─── Marquee ────────────────────────────────────────────── */
function Marquee({ items }) {
  return (
    <div className="nova-marquee-wrap" aria-hidden>
      <div className="nova-marquee-track">
        {[...items, ...items].map((item, i) => <span key={i} className="nova-marquee-item">{item}</span>)}
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────── */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleTheme = useCallback((t) => setTheme(t), [setTheme]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const MARQUEE_ITEMS = ['✦ Notes', '✦ Sticky Notes', '✦ Habit Tracker', '✦ Goal Constellation', '✦ Books', '✦ Shows', '✦ Custom Tables', '✦ Projects', '✦ Dashboard'];

  return (
    <div className="nova-root">
      {/* Ambient orbs */}
      <div className="nova-ambient" aria-hidden>
        <Orb style={{ width: 520, height: 520, top: '-12%', right: '-10%' }} />
        <Orb style={{ width: 360, height: 360, bottom: '22%', left: '-8%' }} cls="nova-orb-2" />
        <Orb style={{ width: 240, height: 240, top: '52%', right: '14%' }} cls="nova-orb-3" />
      </div>

      {/* ══ NAVBAR ══ */}
      <motion.header
        className={`nova-nav ${scrolled ? 'scrolled' : ''}`}
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Link to="/" className="nova-brand"><Zap size={19} className="nova-brand-icon" />SortLife</Link>
        <nav className="nova-nav-links">
          {NAV_LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
          <ThemePicker current={theme} onChange={handleTheme} />
          <Link to="/login" className="nova-nav-login">Log in</Link>
          <Link to="/signup" className="nova-nav-cta">Get Started <ArrowRight size={13} /></Link>
        </nav>
        <div className="nova-nav-right-mobile">
          <ThemePicker current={theme} onChange={handleTheme} />
          <button type="button" className="nova-nav-toggle" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div className="nova-mobile-menu" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {NAV_LINKS.map((l) => <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>{l.label}</a>)}
            <Link to="/login"  onClick={() => setMenuOpen(false)}>Log in</Link>
          <Link to="/signup" onClick={() => setMenuOpen(false)} className="nova-btn-primary">Get Started</Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ HERO ══ */}
      <section className="nova-hero">
        <div className="nova-hero-inner">
          <motion.div className="nova-hero-badge" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Sparkles size={13} /> Personal life operating system
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            One app to organize<br /><span className="nova-gradient-text">your whole life.</span>
          </motion.h1>
          <motion.p className="nova-hero-sub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
            SortLife unifies notes, habits, goals, books, shows, and databases into one warm workspace — so you can plan, build, and achieve without context-switching.
          </motion.p>
          <motion.div className="nova-hero-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}>
            <Link to="/signup" className="nova-btn-primary nova-btn-lg">Get Started <ArrowRight size={16} /></Link>
            <Link to="/login"  className="nova-btn-ghost nova-btn-lg">I already have an account</Link>
          </motion.div>
        </div>
      </section>

      {/* ══ MARQUEE ══ */}
      <Marquee items={MARQUEE_ITEMS} />

      {/* ══ FEATURES ══ */}
      <section id="features" className="nova-section">
        <motion.div className="nova-section-head" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <span className="nova-eyebrow">Features</span>
          <h2>Everything you need, <span className="nova-gradient-text">nothing you don't.</span></h2>
          <p>Every module works together — built as one composition, not bolted-on tools.</p>
        </motion.div>
        <div className="nova-features-grid">
          {FEATURES.map((f, i) => <FeatureCard key={f.title} {...f} index={i} />)}
        </div>
      </section>

      {/* ══ INTERACTIVE DEMO ══ */}
      <section id="demo" className="nova-section nova-demo-section">
        <motion.div className="nova-section-head" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <span className="nova-eyebrow">Live Demo</span>
          <h2>See it in action — <span className="nova-gradient-text">click around.</span></h2>
          <p>Every tab is a real representation of what you get inside the app.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <InteractiveDemo />
        </motion.div>
      </section>

      {/* ══ TESTIMONIALS ══ */}
      <section id="testimonials" className="nova-section nova-testi-section">
        <motion.div className="nova-section-head" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <span className="nova-eyebrow">Reviews</span>
          <h2>Loved by people who <span className="nova-gradient-text">actually use it.</span></h2>
        </motion.div>
        <TestimonialsCarousel />
      </section>

      {/* ══ FINAL CTA ══ */}
      <section className="nova-cta-section">
        <div className="nova-cta-inner">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            Open your workspace <span className="nova-gradient-text">tonight.</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
          Built for humans who want signal over clutter. One workspace, every tool — SortLife.
          </motion.p>
          <motion.div className="nova-cta-btns" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.18 }}>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
              <Link to="/signup" className="nova-btn-primary nova-btn-lg">Get Started <ArrowRight size={16} /></Link>
            </motion.div>
            <Link to="/login" className="nova-btn-ghost nova-btn-lg">Log in</Link>
          </motion.div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="nova-footer">
        <div className="nova-footer-inner">
          <Link to="/" className="nova-brand"><Zap size={17} className="nova-brand-icon" />SortLife</Link>
          <p className="nova-footer-tagline">A personal productivity workspace that feels alive.</p>
          <div className="nova-footer-links">
            <a href="#features">Features</a>
            <a href="#demo">Demo</a>
            <a href="#testimonials">Reviews</a>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </div>
          <p className="nova-footer-copy">© {new Date().getFullYear()} SortLife</p>
        </div>
      </footer>
    </div>
  );
}
