import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Grid2x2, Mail, Lock, User, KeyRound, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { signup, verifyEmail, login, resendCode } from '../utils/api';
import './AuthPage.css';

export default function AuthPage({ redirectTo, initialMode = 'login' }) {
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState(initialMode);  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
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

  const authError = (err, fallback) => {    if (err.code === 'ECONNABORTED') return 'Request timed out. The server may be starting — try again in a moment.';
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

  return (
    <div className="auth-page">
      <Link to="/" className="auth-back-link">
        <ArrowLeft size={16} /> Back to home
      </Link>
      <div className="auth-card">        <div className="auth-logo">
          <Grid2x2 size={28} color="var(--accent)" />
          <h1>SortLife</h1>
        </div>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); navigate('/login'); }}>Log in</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); navigate('/signup'); }}>Sign up</button>
          {mode === 'verify' && <button className="active">Verify</button>}
        </div>

        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="auth-form">
            <div className="auth-field">
              <User size={16} />
              <input placeholder="Your name" value={form.name} onChange={set('name')} required />
            </div>
            <div className="auth-field">
              <Mail size={16} />
              <input type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
            </div>
            <div className="auth-field">
              <Lock size={16} />
              <input type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={set('password')} minLength={6} required />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? loadingMsg || 'Creating…' : 'Create account'}
            </button>
            {/* {loading && <p className="auth-loading-hint">{loadingMsg}</p>} */}
          </form>
        )}

        {mode === 'verify' && (
          <form onSubmit={handleVerify} className="auth-form">
            <p className="auth-hint">Enter the 6-digit code sent to <strong>{form.email}</strong></p>
            <div className="auth-field">
              <Mail size={16} />
              <input type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
            </div>
            <div className="auth-field">
              <KeyRound size={16} />
              <input placeholder="Confirmation code" value={form.code} onChange={set('code')} maxLength={6} required autoFocus />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? loadingMsg || 'Verifying…' : 'Verify & continue'}
            </button>
            <button type="button" className="auth-link-btn" onClick={handleResend}>Resend code</button>
          </form>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="auth-field">
              <Mail size={16} />
              <input type="email" placeholder="Email" value={form.email} onChange={set('email')} required autoFocus />
            </div>
            <div className="auth-field">
              <Lock size={16} />
              <input type="password" placeholder="Password" value={form.password} onChange={set('password')} required />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? loadingMsg || 'Logging in…' : 'Log in'}
            </button>
           
            <p className="auth-footer-note">Session stays active for 7 days</p>
          </form>
        )}
      </div>
    </div>
  );
}
