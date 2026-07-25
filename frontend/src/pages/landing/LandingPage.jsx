import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Menu, X } from 'lucide-react';
import './landing.css';

const FEATURES = [
  { title: 'Notebook gravity', body: 'Capture thoughts that pull related pages into orbit — not another nested folder maze.' },
  { title: 'Habit pulse', body: 'Mark only today. Build streaks the honest way — no rewriting yesterday.' },
  { title: 'Goal constellation', body: 'North-star goals with nested subgoals, micro-wins, and achievements that feel earned.' },
  { title: 'Library lanes', body: 'Books and shows with posters from upload or URL — your media shelf, sorted.' },
  { title: 'Living tables', body: 'Shape custom data boards without spreadsheet fatigue.' },
  { title: 'Project forge', body: 'For developers: tasks, teammates, and chat in one forge — hidden if you are not building.' },
];

const INCLUDES = [
  'Unlimited notes & sticky notes',
  'Habits, goals & achievements',
  'Books & shows library',
  'Custom tables',
  '5 workspace themes',
  'Mobile-first experience',
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="landing-root">
      <header className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
        <Link to="/" className="lp-brand">Sort<span>Life</span></Link>
        <div className="lp-nav-links">
          <a href="#atlas">Atlas</a>
          <a href="#features">Systems</a>
          <a href="#pricing">Access</a>
          <Link to="/login">Log in</Link>
          <Link to="/signup" className="lp-nav-cta">Enter free <ArrowRight size={14} /></Link>
        </div>
        <button type="button" className="lp-nav-toggle" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      <div className={`lp-mobile-menu ${menuOpen ? 'open' : ''}`}>
        <a href="#atlas" onClick={() => setMenuOpen(false)}>Atlas</a>
        <a href="#features" onClick={() => setMenuOpen(false)}>Systems</a>
        <a href="#pricing" onClick={() => setMenuOpen(false)}>Access</a>
        <Link to="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
        <Link to="/signup" onClick={() => setMenuOpen(false)}>Start free forever</Link>
      </div>

      <section className="lp-hero">
        <div className="lp-hero-bg" />
        <div className="lp-orbit" aria-hidden />
        <div className="lp-hero-inner">
          <motion.p
            className="lp-kicker"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Personal life operating system
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            Sort<span className="lp-serif">Life</span>
            <br />
            map your days into <em>signal</em>
          </motion.h1>
          <motion.p
            className="lp-hero-sub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
          >
            One workspace for notes, habits, goals, books, shows, and tables —
            designed to feel like an atlas of your attention, not another dashboard.
          </motion.p>
          <motion.div
            className="lp-hero-actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
          >
            <Link to="/signup" className="lp-btn-primary">
              Start totally free <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="lp-btn-ghost">I already have an atlas</Link>
          </motion.div>
          <motion.p
            className="lp-forever"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <strong>Totally free forever.</strong> No trials. No credit card. No “free for now.”
          </motion.p>
        </div>
      </section>

      <div className="lp-strip" id="atlas">
        {[
          ['01', 'Capture'],
          ['02', 'Habit'],
          ['03', 'Aim'],
          ['04', 'Review'],
        ].map(([n, label]) => (
          <article key={n}>
            <strong>{n}</strong>
            <span>{label} · daily orbit</span>
          </article>
        ))}
      </div>

      <section className="lp-section" id="features">
        <h2>Systems that feel <span className="lp-serif">alive</span></h2>
        <p className="lp-lead">
          Built as one composition — brand first, noise last. Every module is a chapter in how you run your life.
        </p>
        <div className="lp-features">
          {FEATURES.map((f, i) => (
            <motion.article
              key={f.title}
              className="lp-feature"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <div style={{ color: 'var(--signal)', fontWeight: 800, fontSize: 12, letterSpacing: '0.12em' }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="lp-section" id="pricing">
        <div className="lp-pricing-wrap">
          <p className="lp-kicker" style={{ justifyContent: 'center' }}>Access</p>
          <h2 style={{ margin: '0 auto 8px', maxWidth: 'none' }}>One plan.</h2>
          <div className="lp-price-tag">$0</div>
          <p className="lp-forever" style={{ marginBottom: 8 }}>
            <strong>Totally free forever</strong> — the whole SortLife atlas.
          </p>
          <p style={{ color: 'var(--mute)', maxWidth: 420, margin: '0 auto' }}>
            We do not gate your life behind a countdown. Premium tiers may appear later for teams —
            personal SortLife stays free.
          </p>
          <ul className="lp-price-list">
            {INCLUDES.map((item) => (
              <li key={item}>✓ {item}</li>
            ))}
          </ul>
          <Link to="/signup" className="lp-btn-primary">
            Claim your free forever seat <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="lp-footer">
        <h2>Open your atlas tonight</h2>
        <p>Totally free forever. Built for humans who want signal over clutter.</p>
        <Link to="/signup" className="lp-btn-primary">
          Enter SortLife <ArrowRight size={16} />
        </Link>
        <p className="lp-copy">© {new Date().getFullYear()} SortLife · Totally free forever</p>
      </footer>
    </div>
  );
}
