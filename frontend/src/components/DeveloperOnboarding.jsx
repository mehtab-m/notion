import React, { useState } from 'react';
import { Code2, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { updatePreferences } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './DeveloperOnboarding.css';

export default function DeveloperOnboarding() {
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(null);

  const choose = async (isDeveloper) => {
    setLoading(isDeveloper ? 'dev' : 'user');
    try {
      const data = await updatePreferences({ isDeveloper });
      updateUser(data.user);
      toast.success(
        isDeveloper
          ? 'Projects unlocked — welcome, developer!'
          : 'Got it — Projects will stay hidden.'
      );
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save preference');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="dev-onboard-overlay">
      <div className="dev-onboard-card" role="dialog" aria-labelledby="dev-onboard-title">
        <p className="dev-onboard-eyebrow">Welcome to SortLife</p>
        <h2 id="dev-onboard-title">Are you a developer?</h2>
        <p className="dev-onboard-sub">
          Developers get the Projects workspace for building and tracking work.
          If you are not a developer, we will hide that section so your space stays focused.
        </p>
        <div className="dev-onboard-choices">
          <button
            type="button"
            className="dev-onboard-choice"
            disabled={!!loading}
            onClick={() => choose(true)}
          >
            <Code2 size={28} />
            <strong>Yes, I am a developer</strong>
            <span>Show Projects in my sidebar</span>
            {loading === 'dev' && <em>Saving…</em>}
          </button>
          <button
            type="button"
            className="dev-onboard-choice"
            disabled={!!loading}
            onClick={() => choose(false)}
          >
            <UserRound size={28} />
            <strong>No, I am not</strong>
            <span>Hide Projects completely</span>
            {loading === 'user' && <em>Saving…</em>}
          </button>
        </div>
      </div>
    </div>
  );
}
