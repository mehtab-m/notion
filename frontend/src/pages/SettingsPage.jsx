import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  User, Lock, Palette, Code2, Crown, Shield, Bell, Database,
  Download, Upload, Trash2, Camera, AlertTriangle, Check, FileJson, FileSpreadsheet,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  updateProfile, updatePassword, updatePreferences, updateNotifications,
  uploadAvatar, removeAvatar, deleteAccount, getDataSummary, exportData,
  exportCsv, importData, getApiBase,
} from '../utils/api';
import ThemeStudio from '../components/ThemeStudio';
import { onInstallAvailable, promptInstall, isStandalone } from '../utils/pwa';
import ConfirmDialog from '../components/ConfirmDialog';
import './SettingsPage.css';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'workspace', label: 'Workspace', icon: Code2 },
  { id: 'data', label: 'Your data', icon: Database },
  { id: 'security', label: 'Security', icon: Lock },
];

const NOTIFICATION_FIELDS = [
  { key: 'weeklySummary', label: 'Weekly recap email', hint: 'A Monday summary of the week just gone.' },
  { key: 'productUpdates', label: 'Product updates', hint: 'Occasional email when something new ships.' },
  { key: 'habitReminders', label: 'Habit reminders', hint: 'A nudge for habits still unchecked late in the day.' },
  { key: 'focusChime', label: 'Focus chime', hint: 'Play a short tone when a focus block ends.' },
  { key: 'soundEffects', label: 'Sound effects', hint: 'Small sounds when you complete things.' },
  { key: 'desktopNotifications', label: 'Desktop notifications', hint: 'Requires permission from your browser.' },
];

const COLLECTION_LABELS = {
  notes: 'Notes', books: 'Books', shows: 'Shows', habits: 'Habits',
  goals: 'Goals', tables: 'Tables', stickyNotes: 'Sticky notes',
  inbox: 'Inbox items', focusSessions: 'Focus sessions',
};

function planLabel(plan) {
  if (plan === 'platinum') return 'Platinum';
  if (plan === 'premium') return 'Premium';
  return 'Common';
}

/** Trigger a browser download for a Blob or a JSON object. */
function download(content, filename, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([JSON.stringify(content, null, 2)], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const location = useLocation();

  const [section, setSection] = useState('profile');
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [notifications, setNotifications] = useState(user?.notificationPrefs || {});
  const [counts, setCounts] = useState(null);
  const [saving, setSaving] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ password: '', confirm: '' });
  const [canInstallApp, setCanInstallApp] = useState(false);
  const avatarInput = useRef(null);
  const importInput = useRef(null);

  /* /settings#appearance from the navbar and the sidebar deep-links
     straight into a section. */
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (SECTIONS.some((s) => s.id === hash)) setSection(hash);
  }, [location.hash]);

  useEffect(() => {
    setNotifications(user?.notificationPrefs || {});
  }, [user?.notificationPrefs]);

  /* Chrome hands us the install event whenever it decides the app
     qualifies, which can be well after this page mounts. */
  useEffect(() => onInstallAvailable(setCanInstallApp), []);

  const loadCounts = useCallback(async () => {
    try {
      const data = await getDataSummary();
      setCounts(data.counts);
    } catch {
      /* The export panel still works without the counts. */
    }
  }, []);

  useEffect(() => {
    if (section === 'data' && !counts) loadCounts();
  }, [section, counts, loadCounts]);

  const busy = (key, value) => setSaving((prev) => ({ ...prev, [key]: value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    busy('profile', true);
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
      busy('profile', false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    busy('password', true);
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
      busy('password', false);
    }
  };

  const saveDeveloper = async (isDeveloper) => {
    busy('dev', true);
    try {
      const data = await updatePreferences({ isDeveloper });
      updateUser(data.user);
      toast.success(isDeveloper ? 'Projects unlocked' : 'Projects hidden');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update preference');
    } finally {
      busy('dev', false);
    }
  };

  const toggleNotification = async (key) => {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);

    /* Desktop notifications are meaningless without OS permission, so
       ask for it the moment the switch goes on. */
    if (key === 'desktopNotifications' && next[key] && 'Notification' in window) {
      const result = await Notification.requestPermission();
      if (result !== 'granted') {
        setNotifications((prev) => ({ ...prev, [key]: false }));
        toast.error('Your browser blocked notifications');
        return;
      }
    }

    try {
      const data = await updateNotifications({ [key]: next[key] });
      updateUser(data.user);
    } catch (err) {
      setNotifications(notifications);
      toast.error(err.response?.data?.error || 'Could not save that preference');
    }
  };

  const onAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Pick an image under 4MB');
      return;
    }
    busy('avatar', true);
    try {
      const data = await uploadAvatar(file);
      updateUser(data.user);
      toast.success('Avatar updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not upload that image');
    } finally {
      busy('avatar', false);
    }
  };

  const clearAvatar = async () => {
    busy('avatar', true);
    try {
      const data = await removeAvatar();
      updateUser(data.user);
      toast.success('Avatar removed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not remove the avatar');
    } finally {
      busy('avatar', false);
    }
  };

  const onExportJson = async () => {
    busy('export', true);
    try {
      const payload = await exportData();
      download(payload, `sortlife-export-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      busy('export', false);
    }
  };

  const onExportCsv = async (collection) => {
    busy(`csv-${collection}`, true);
    try {
      const blob = await exportCsv(collection);
      download(blob, `sortlife-${collection}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      busy(`csv-${collection}`, false);
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    busy('import', true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await importData(payload, 'merge');
      toast.success(result.message);
      if (result.skipped?.length) {
        toast.error(`Skipped: ${result.skipped.map((s) => s.collection).join(', ')}`);
      }
      loadCounts();
    } catch (err) {
      toast.error(
        err instanceof SyntaxError
          ? 'That file is not valid JSON'
          : err.response?.data?.error || 'Import failed'
      );
    } finally {
      busy('import', false);
    }
  };

  const onDeleteAccount = async () => {
    setConfirmDelete(false);
    busy('delete', true);
    try {
      await deleteAccount(deleteForm);
      toast.success('Your account has been deleted');
      setTimeout(logout, 900);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete the account');
    } finally {
      busy('delete', false);
    }
  };

  const initials = (user?.name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const avatar = user?.avatarUrl
    ? user.avatarUrl.startsWith('http')
      ? user.avatarUrl
      : `${getApiBase()}${user.avatarUrl}`
    : null;

  const stars = user?.premiumStars || 0;
  const holders = user?.premiumStarHolders || 5;

  return (
    <div className="settings-page page-enter">
      {/* ── Identity header ──────────────────────────────── */}
      <header className="settings-hero">
        <div className="settings-avatar-wrap">
          <div className={`settings-avatar plan-${user?.plan}`}>
            {avatar ? <img src={avatar} alt="" /> : initials}
          </div>
          <button
            type="button"
            className="settings-avatar-edit"
            onClick={() => avatarInput.current?.click()}
            disabled={saving.avatar}
            aria-label="Change avatar"
            title="Change avatar"
          >
            <Camera size={13} />
          </button>
          <input
            ref={avatarInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onAvatarPick}
            hidden
          />
        </div>

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
            <em>
              {planLabel(user?.plan)} · through{' '}
              {user?.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString() : 'Mar 15, 2027'}
            </em>
          </div>
          {avatar && (
            <button type="button" className="settings-avatar-remove" onClick={clearAvatar}>
              Remove photo
            </button>
          )}
        </div>
      </header>

      <div className="settings-layout">
        {/* ── Section nav ────────────────────────────────── */}
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`settings-nav-item ${section === id ? 'active' : ''}`}
              onClick={() => setSection(id)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="settings-body">
          {/* ── Profile ──────────────────────────────────── */}
          {section === 'profile' && (
            <section className="settings-card">
              <div className="settings-card-head">
                <User size={16} />
                <h2>Profile</h2>
              </div>
              <form onSubmit={saveProfile} className="settings-form">
                <div className="form-group">
                  <label htmlFor="settings-name">Full name</label>
                  <input
                    id="settings-name"
                    value={profile.name}
                    onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-email">Email</label>
                  <input
                    id="settings-email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                    required
                  />
                  <p className="form-hint">
                    Changing this changes the address you sign in with.
                  </p>
                </div>
                <div className="settings-readonly-row">
                  <span>Role</span>
                  <strong>{user?.role === 'admin' ? 'Administrator' : 'Member'}</strong>
                </div>
                <div className="settings-readonly-row">
                  <span>Member since</span>
                  <strong>
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                  </strong>
                </div>
                <button type="submit" className="btn btn-primary" disabled={saving.profile}>
                  {saving.profile ? 'Saving…' : 'Save profile'}
                </button>
              </form>
            </section>
          )}

          {/* ── Appearance ───────────────────────────────── */}
          {section === 'appearance' && <ThemeStudio />}

          {/* ── Notifications ────────────────────────────── */}
          {section === 'notifications' && (
            <section className="settings-card">
              <div className="settings-card-head">
                <Bell size={16} />
                <h2>Notifications</h2>
              </div>
              <p className="settings-hint">
                Email settings apply to the address on your profile. In-app nudges respect
                your quiet hours.
              </p>

              <div className="settings-switches">
                {NOTIFICATION_FIELDS.map((field) => (
                  <div key={field.key} className="switch-row">
                    <div className="switch-row-copy">
                      <strong>{field.label}</strong>
                      <span>{field.hint}</span>
                    </div>
                    <button
                      type="button"
                      className="switch"
                      role="switch"
                      aria-checked={!!notifications[field.key]}
                      aria-label={field.label}
                      onClick={() => toggleNotification(field.key)}
                    />
                  </div>
                ))}
              </div>

              <div className="settings-quiet">
                <div className="switch-row-copy">
                  <strong>Quiet hours</strong>
                  <span>In-app nudges stay silent between these times.</span>
                </div>
                <div className="settings-quiet-inputs">
                  <label>
                    From
                    <select
                      value={notifications.quietHoursStart ?? 22}
                      onChange={async (e) => {
                        const value = Number(e.target.value);
                        setNotifications((p) => ({ ...p, quietHoursStart: value }));
                        try {
                          const data = await updateNotifications({ quietHoursStart: value });
                          updateUser(data.user);
                        } catch {
                          toast.error('Could not save quiet hours');
                        }
                      }}
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    To
                    <select
                      value={notifications.quietHoursEnd ?? 8}
                      onChange={async (e) => {
                        const value = Number(e.target.value);
                        setNotifications((p) => ({ ...p, quietHoursEnd: value }));
                        try {
                          const data = await updateNotifications({ quietHoursEnd: value });
                          updateUser(data.user);
                        } catch {
                          toast.error('Could not save quiet hours');
                        }
                      }}
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </section>
          )}

          {/* ── Workspace ────────────────────────────────── */}
          {section === 'workspace' && (
            <section className="settings-card">
              <div className="settings-card-head">
                <Code2 size={16} />
                <h2>Workspace</h2>
              </div>
              <p className="settings-hint">
                Developer mode controls whether Projects appear in your sidebar and whether
                the project API is available to your account.
              </p>
              <div className="settings-dev-actions">
                <button
                  type="button"
                  className={`btn ${user?.isDeveloper === true ? 'btn-primary' : 'btn-secondary'}`}
                  disabled={saving.dev || user?.isDeveloper === true}
                  onClick={() => saveDeveloper(true)}
                >
                  {user?.isDeveloper === true && <Check size={14} />} I am a developer
                </button>
                <button
                  type="button"
                  className={`btn ${user?.isDeveloper === false ? 'btn-primary' : 'btn-secondary'}`}
                  disabled={saving.dev || user?.isDeveloper === false}
                  onClick={() => saveDeveloper(false)}
                >
                  {user?.isDeveloper === false && <Check size={14} />} I am not a developer
                </button>
              </div>

              <div className="divider" />

              {(canInstallApp || isStandalone()) && (
                <>
                  <div className="settings-install">
                    <span className="settings-install-icon"><Smartphone size={17} /></span>
                    <div className="switch-row-copy">
                      <strong>{isStandalone() ? 'Installed' : 'Install SortLife'}</strong>
                      <span>
                        {isStandalone()
                          ? 'You are running the installed app. The shell and cached pages keep working offline.'
                          : 'Add it to your home screen or dock. Opens without browser chrome and keeps working offline.'}
                      </span>
                    </div>
                    {!isStandalone() && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={async () => {
                          const accepted = await promptInstall();
                          if (accepted) toast.success('Installing…');
                        }}
                      >
                        Install
                      </button>
                    )}
                  </div>
                  <div className="divider" />
                </>
              )}

              <div className="settings-links">
                <Link to="/archive" className="settings-link-row">
                  <strong>Archive &amp; trash</strong>
                  <span>Restore anything you shelved or deleted in the last 30 days.</span>
                </Link>
                <Link to="/upgrade" className="settings-link-row">
                  <strong>Plans</strong>
                  <span>Compare Common, Premium and Platinum.</span>
                </Link>
              </div>
            </section>
          )}

          {/* ── Data ─────────────────────────────────────── */}
          {section === 'data' && (
            <>
              <section className="settings-card">
                <div className="settings-card-head">
                  <Download size={16} />
                  <h2>Export</h2>
                </div>
                <p className="settings-hint">
                  Everything you have created, in a single file you can keep, read, or import
                  back into another account. No plan restricts this.
                </p>

                <div className="settings-export-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onExportJson}
                    disabled={saving.export}
                  >
                    <FileJson size={15} />
                    {saving.export ? 'Preparing…' : 'Download everything (JSON)'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => importInput.current?.click()}
                    disabled={saving.import}
                  >
                    <Upload size={15} />
                    {saving.import ? 'Importing…' : 'Import a JSON export'}
                  </button>
                  <input
                    ref={importInput}
                    type="file"
                    accept="application/json,.json"
                    onChange={onImport}
                    hidden
                  />
                </div>

                {counts && (
                  <ul className="settings-counts">
                    {Object.entries(COLLECTION_LABELS).map(([key, label]) => (
                      <li key={key}>
                        <span>{label}</span>
                        <strong className="tabular">{counts[key] ?? 0}</strong>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => onExportCsv(key)}
                          disabled={!counts[key] || saving[`csv-${key}`]}
                          title={`Download ${label} as CSV`}
                        >
                          <FileSpreadsheet size={13} /> CSV
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="settings-card settings-card--danger">
                <div className="settings-card-head">
                  <AlertTriangle size={16} />
                  <h2>Delete account</h2>
                </div>
                <p className="settings-hint">
                  This removes your account and every note, goal, habit, book, show, table and
                  transaction attached to it. It cannot be undone — export first if you want a copy.
                </p>

                <div className="form-group">
                  <label htmlFor="delete-password">Confirm your password</label>
                  <input
                    id="delete-password"
                    type="password"
                    value={deleteForm.password}
                    onChange={(e) => setDeleteForm((p) => ({ ...p, password: e.target.value }))}
                    autoComplete="current-password"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="delete-confirm">Type DELETE to confirm</label>
                  <input
                    id="delete-confirm"
                    value={deleteForm.confirm}
                    onChange={(e) => setDeleteForm((p) => ({ ...p, confirm: e.target.value }))}
                    placeholder="DELETE"
                    autoComplete="off"
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={
                    saving.delete ||
                    !deleteForm.password ||
                    deleteForm.confirm.trim().toUpperCase() !== 'DELETE'
                  }
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={15} /> Delete my account
                </button>
              </section>
            </>
          )}

          {/* ── Security ─────────────────────────────────── */}
          {section === 'security' && (
            <section className="settings-card">
              <div className="settings-card-head">
                <Lock size={16} />
                <h2>Password</h2>
              </div>
              <form onSubmit={savePassword} className="settings-form">
                <div className="form-group">
                  <label htmlFor="pw-current">Current password</label>
                  <input
                    id="pw-current"
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="pw-new">New password</label>
                  <input
                    id="pw-new"
                    type="password"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <p className="form-hint">At least 8 characters.</p>
                </div>
                <div className="form-group">
                  <label htmlFor="pw-confirm">Confirm new password</label>
                  <input
                    id="pw-confirm"
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  {passwords.confirm && passwords.confirm !== passwords.newPassword && (
                    <p className="form-hint form-error">These do not match.</p>
                  )}
                </div>
                <button type="submit" className="btn btn-primary" disabled={saving.password}>
                  {saving.password ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete your account permanently?"
        message="Every note, goal, habit, book, show, table and transaction will be erased. This cannot be undone."
        confirmLabel="Yes, delete everything"
        danger
        onConfirm={onDeleteAccount}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
