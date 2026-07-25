import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Settings as SettingsIcon, Palette, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { updateProfile, updatePassword, updatePreferences } from '../utils/api';
import './SettingsPage.css';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme, themes } = useTheme();
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

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="settings-lede">Account, security, and workspace theme. Role cannot be changed here.</p>
        </div>
      </div>

      <section className="settings-panel">
        <div className="settings-panel-head">
          <Palette size={18} />
          <h2>Theme</h2>
        </div>
        <p className="settings-hint">Pick one of five atmospheres for the whole app.</p>
        <div className="theme-grid">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`theme-card ${theme === t.id ? 'active' : ''}`}
              onClick={() => setTheme(t.id)}
            >
              <div className="theme-swatches">
                {t.swatch.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </div>
              <strong>{t.label}</strong>
              <span>{t.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-panel">
        <div className="settings-panel-head">
          <User size={18} />
          <h2>Profile</h2>
        </div>
        <form onSubmit={saveProfile} className="settings-form">
          <div className="form-group">
            <label>Display name</label>
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
          <div className="form-group">
            <label>Role</label>
            <input value={user?.role === 'admin' ? 'Admin (read-only)' : 'User (read-only)'} disabled />
            <p className="settings-hint">Role is managed by product admins and cannot be changed.</p>
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>

      <section className="settings-panel">
        <div className="settings-panel-head">
          <Lock size={18} />
          <h2>Password</h2>
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
          <div className="form-row">
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
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingPass}>
            {savingPass ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>

      <section className="settings-panel settings-meta">
        <SettingsIcon size={16} />
        <div className="settings-dev-block">
          <p>Developer mode: {user?.isDeveloper === true ? 'On' : user?.isDeveloper === false ? 'Off' : 'Not chosen'}</p>
          <p className="settings-hint">
            Developers see the Projects section. Non-developers keep it hidden entirely.
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
        </div>
      </section>
    </div>
  );
}
