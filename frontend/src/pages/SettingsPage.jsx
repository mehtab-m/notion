import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { User, Lock, Palette, Code2, Crown, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { updateProfile, updatePassword, updatePreferences } from '../utils/api';
import './SettingsPage.css';

function planLabel(plan) {
  if (plan === 'platinum') return 'Platinum';
  if (plan === 'premium') return 'Premium';
  return 'Common';
}

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme, themes, customVars, updateCustomVar, resetCustom, themeVars } = useTheme();
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirm: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [savingDev, setSavingDev] = useState(false);

  const saveDeveloper = async (isDeveloper) => {
    setSavingDev(true);
    try {
      const data = await updatePreferences({ isDeveloper });
      updateUser(data.user);
      toast.success(isDeveloper ? 'Projects unlocked' : 'Projects hidden');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update preference');
    } finally {
      setSavingDev(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const data = await updateProfile({
        name: profile.name.trim(),
        email: profile.email.trim(),
      });
      updateUser(data.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPass(true);
    try {
      await updatePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update password');
    } finally {
      setSavingPass(false);
    }
  };

  const initials = (user?.name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const stars = user?.premiumStars || 0;
  const holders = user?.premiumStarHolders || 5;

  return (
    <div className="settings-page">
      <header className="settings-hero">
        <div className="settings-avatar" aria-hidden>{initials}</div>
        <div className="settings-hero-copy">
          <div className="settings-hero-top">
            <h1>{user?.name || 'Account'}</h1>
            {(user?.plan === 'premium' || user?.plan === 'platinum') && (
              <span className={`settings-plan-badge plan-${user.plan}`}>
                <Crown size={13} />
                {planLabel(user.plan)}
              </span>
            )}
            {user?.role === 'admin' && (
              <span className="settings-plan-badge plan-admin">
                <Shield size={13} /> Admin
              </span>
            )}
          </div>
          <p className="settings-hero-email">{user?.email}</p>
          <div className="settings-star-row" title={`${stars} of ${holders} plan stars`}>
            {Array.from({ length: holders }).map((_, i) => (
              <span key={i} className={i < stars ? 'on' : ''}>{i < stars ? '★' : '☆'}</span>
            ))}
            <em>{planLabel(user?.plan)} · through {user?.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString() : 'Mar 15, 2027'}</em>
          </div>
        </div>
      </header>

      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-card-head">
            <User size={16} />
            <h2>Profile</h2>
          </div>
          <form onSubmit={saveProfile} className="settings-form">
            <div className="form-group">
              <label>Full name</label>
              <input
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
            <div className="settings-readonly-row">
              <span>Role</span>
              <strong>{user?.role === 'admin' ? 'Administrator' : 'Member'}</strong>
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <Lock size={16} />
            <h2>Security</h2>
          </div>
          <form onSubmit={savePassword} className="settings-form">
            <div className="form-group">
              <label>Current password</label>
              <input
                type="password"
                value={passwords.currentPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="form-group">
              <label>New password</label>
              <input
                type="password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label>Confirm new password</label>
              <input
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingPass}>
              {savingPass ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </section>

        <section className="settings-card settings-card-wide">
          <div className="settings-card-head">
            <Palette size={16} />
            <h2>Appearance</h2>
          </div>
          <div className="theme-grid">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-card ${theme === t.id ? 'active' : ''}`}
                onClick={() => setTheme(t.id)}
              >
                <div className="theme-swatches">
                  {t.swatch.map((c) => <i key={c} style={{ background: c }} />)}
                </div>
                <strong>{t.label}</strong>
                <span>{t.desc}</span>
              </button>
            ))}
          </div>

          {theme === 'custom' && (
            <div className="theme-editor">
              <div className="theme-editor-head">
                <h3>Custom palette</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={resetCustom}>
                  Reset defaults
                </button>
              </div>
              <div className="theme-editor-grid">
                {themeVars.map(({ key, label }) => (
                  <label key={key} className="theme-var-field">
                    <span>{label}</span>
                    <div className="theme-var-inputs">
                      <input
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(customVars[key]) ? customVars[key] : '#000000'}
                        onChange={(e) => updateCustomVar(key, e.target.value)}
                      />
                      <input
                        type="text"
                        value={customVars[key] || ''}
                        onChange={(e) => updateCustomVar(key, e.target.value)}
                        spellCheck={false}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <Code2 size={16} />
            <h2>Workspace</h2>
          </div>
          <p className="settings-hint">
            Developer mode controls whether Projects appear in your sidebar and API access.
          </p>
          <div className="settings-dev-actions">
            <button
              type="button"
              className={`btn ${user?.isDeveloper === true ? 'btn-primary' : 'btn-secondary'}`}
              disabled={savingDev || user?.isDeveloper === true}
              onClick={() => saveDeveloper(true)}
            >
              I am a developer
            </button>
            <button
              type="button"
              className={`btn ${user?.isDeveloper === false ? 'btn-primary' : 'btn-secondary'}`}
              disabled={savingDev || user?.isDeveloper === false}
              onClick={() => saveDeveloper(false)}
            >
              I am not a developer
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
