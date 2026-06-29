import React, { useState } from 'react';
import { Grid2x2, Mail, Lock, User, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { signup, verifyEmail, login, resendCode } from '../utils/api';
import './AuthPage.css';

export default function AuthPage() {
  const { login: authLogin } = useAuth();
  const [mode, setMode] = useState('login'); // login | signup | verify
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', code: '' });

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signup({ name: form.name, email: form.email, password: form.password });
      toast.success('Check your email for the confirmation code');
      setMode('verify');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, user } = await verifyEmail({ email: form.email, code: form.code });
      authLogin(token, user);
      toast.success('Welcome!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, user } = await login({ email: form.email, password: form.password });
      authLogin(token, user);
      toast.success(`Welcome back, ${user.name}!`);
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsVerification) {
        toast.error('Please verify your email first');
        setMode('verify');
      } else {
        toast.error(data?.error || 'Login failed');
      }
    } finally {
      setLoading(false);
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
      <div className="auth-card">
        <div className="auth-logo">
          <Grid2x2 size={28} color="var(--accent)" />
          <h1>My Notion</h1>
        </div>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Log in</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign up</button>
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
              {loading ? 'Creating...' : 'Create account'}
            </button>
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
              {loading ? 'Verifying...' : 'Verify & continue'}
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
              {loading ? 'Logging in...' : 'Log in'}
            </button>
            <p className="auth-footer-note">Session stays active for 7 days</p>
          </form>
        )}
      </div>
    </div>
  );
}
