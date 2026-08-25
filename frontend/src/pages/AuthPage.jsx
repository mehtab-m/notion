import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail, Lock, User, KeyRound, ArrowLeft, Sparkles, Eye, EyeOff,
  Check, Sun, Moon, Flame, Timer, Palette,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { signup, verifyEmail, login, resendCode } from '../utils/api';
import './AuthPage.css';

/* The three lines on the brand panel. Kept short — this is the last
   thing between someone and the app, not a second landing page. */
const HIGHLIGHTS = [
  { icon: Flame, text: 'Streaks you cannot fake — only today can be ticked.' },
  { icon: Timer, text: 'A focus timer that keeps counting in the tab title.' },
  { icon: Palette, text: 'Nine themes, and a builder for one of your own.' },
];

export default function AuthPage({ redirectTo, initialMode = 'login' }) {
  const { login: authLogin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', code: '' });
  const loadingTimers = useRef([]);

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const startLoading = (initialMsg) => {
    loadingTimers.current.forEach(clearTimeout);
    loadingTimers.current = [];
    setLoading(true);
    setLoadingMsg(initialMsg);
    loadingTimers.current.push(
      setTimeout(() => setLoadingMsg('Connecting to server…'), 4000),
      setTimeout(() => setLoadingMsg('Server may be waking up — first request can take up to 60s…'), 12000),
      setTimeout(() => setLoadingMsg('Still working, almost there…'), 35000),
    );
  };

  const stopLoading = () => {
    loadingTimers.current.forEach(clearTimeout);
    loadingTimers.current = [];
    setLoading(false);
    setLoadingMsg('');
  };

  useEffect(() => () => loadingTimers.current.forEach(clearTimeout), []);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const authError = (err, fallback) => {
    if (err.code === 'ECONNABORTED') return 'Request timed out. The server may be starting — try again in a moment.';
    if (!err.response) return 'Cannot reach server. Check your connection or try again shortly.';
    return err.response?.data?.error || fallback;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    startLoading('Creating account…');
    try {
      await signup({ name: form.name, email: form.email, password: form.password });
      toast.success('Account created — check your email for the code');
      setMode('verify');
    } catch (err) {
      toast.error(authError(err, 'Signup failed'));
    } finally {
      stopLoading();
    }
  };

  const goAfterAuth = () => {
    navigate(redirectTo || '/', { replace: true });
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    startLoading('Verifying…');
    try {
      const { token, user } = await verifyEmail({ email: form.email, code: form.code });
      authLogin(token, user);
      toast.success('Welcome!');
      goAfterAuth();
    } catch (err) {
      toast.error(authError(err, 'Verification failed'));
    } finally {
      stopLoading();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    startLoading('Logging in…');
    try {
      const { token, user } = await login({ email: form.email, password: form.password });
      authLogin(token, user);
      toast.success(`Welcome back, ${user.name}!`);
      goAfterAuth();
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsVerification) {
        toast.error('Please verify your email first');
        setMode('verify');
      } else {
        toast.error(authError(err, 'Login failed'));
      }
    } finally {
      stopLoading();
    }
  };

  const handleResend = async () => {
    try {
      await resendCode(form.email);
      toast.success('New code sent');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resend');
    }
  };

  /* Rough strength read-out. Deliberately advisory — the server enforces
     the only rule that matters, which is the 8-character minimum. */
  const strength = (() => {
    const value = form.password;
    if (!value) return 0;
    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
    return score;
  })();

  const STRENGTH_LABELS = ['', 'Weak', 'Okay', 'Good', 'Strong'];

  return (
    <div className="auth-page">
      {/* ── Brand panel ──────────────────────────────────── */}
      <aside className="auth-aside">
        <div className="auth-aside-glow" aria-hidden />

        <Link to="/" className="auth-brand">
          <span className="auth-brand-mark"><Sparkles size={17} /></span>
          SortLife
        </Link>

        <div className="auth-aside-body">
          <h2>Everything in one place, finally.</h2>
          <p>
            Notes, goals, habits, books, shows, projects and money — one workspace,
            one theme, one export button. Free forever.
          </p>

          <ul className="auth-highlights">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span><Icon size={15} /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-aside-foot">
          <Check size={13} /> No credit card, no trial, no lock-in.
        </p>
      </aside>

      {/* ── Form panel ───────────────────────────────────── */}
      <main className="auth-main">
        <div className="auth-topbar">
          <Link to="/" className="auth-back-link">
            <ArrowLeft size={15} /> Back to home
          </Link>
          <button
            type="button"
            className="auth-theme-btn"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to a light theme' : 'Switch to a dark theme'}
          >
            {isDark ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>

        <div className="auth-card">
          <div className="auth-card-head">
            <h1>
              {mode === 'signup' ? 'Create your workspace'
                : mode === 'verify' ? 'Check your email'
                  : 'Welcome back'}
            </h1>
            <p>
              {mode === 'signup' ? 'It takes about thirty seconds.'
                : mode === 'verify' ? `We sent a six-digit code to ${form.email || 'your inbox'}.`
                  : 'Pick up exactly where you left off.'}
            </p>
          </div>

          {mode !== 'verify' && (
            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={mode === 'login' ? 'active' : ''}
                onClick={() => { setMode('login'); navigate('/login'); }}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                className={mode === 'signup' ? 'active' : ''}
                onClick={() => { setMode('signup'); navigate('/signup'); }}
              >
                Sign up
              </button>
              <span className={`auth-tabs-glide ${mode === 'signup' ? 'to-right' : ''}`} aria-hidden />
            </div>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="auth-form">
              <div className="auth-field">
                <User size={16} />
                <input
                  placeholder="Your name"
                  value={form.name}
                  onChange={set('name')}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="auth-field">
                <Mail size={16} />
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="auth-field">
                <Lock size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (min 8 characters)"
                  value={form.password}
                  onChange={set('password')}
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {form.password && (
                <div className={`auth-strength s-${strength}`}>
                  <span /><span /><span /><span />
                  <em>{STRENGTH_LABELS[strength]}</em>
                </div>
              )}

              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? loadingMsg || 'Creating…' : 'Create account'}
              </button>
            </form>
          )}

          {mode === 'verify' && (
            <form onSubmit={handleVerify} className="auth-form">
              <div className="auth-field">
                <Mail size={16} />
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="auth-field">
                <KeyRound size={16} />
                <input
                  className="auth-code"
                  placeholder="000000"
                  value={form.code}
                  onChange={set('code')}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? loadingMsg || 'Verifying…' : 'Verify & continue'}
              </button>
              <div className="auth-links">
                <button type="button" className="auth-link-btn" onClick={handleResend}>
                  Resend the code
                </button>
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() => { setMode('login'); navigate('/login'); }}
                >
                  Back to log in
                </button>
              </div>
            </form>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="auth-form">
              <div className="auth-field">
                <Mail size={16} />
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                  required
                  autoFocus
                />
              </div>
              <div className="auth-field">
                <Lock size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? loadingMsg || 'Logging in…' : 'Log in'}
              </button>
              <p className="auth-footer-note">Your session stays active for 7 days.</p>
            </form>
          )}
        </div>

        <p className="auth-switch">
          {mode === 'signup' ? (
            <>Already have an account? <button type="button" onClick={() => { setMode('login'); navigate('/login'); }}>Log in</button></>
          ) : mode === 'login' ? (
            <>New here? <button type="button" onClick={() => { setMode('signup'); navigate('/signup'); }}>Create an account</button></>
          ) : null}
        </p>
      </main>
    </div>
  );
}
