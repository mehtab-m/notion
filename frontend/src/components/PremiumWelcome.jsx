import React, { useEffect, useState } from 'react';
import { Crown, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './PremiumWelcome.css';

/**
 * Premium welcome: 5 star holders; filled stars slam into place.
 * Only for first 10 logins (server sets showPremiumWelcome).
 */
export default function PremiumWelcome() {
  const { user, updateUser } = useAuth();
  const [phase, setPhase] = useState('idle'); // idle | animating | done
  const [visible, setVisible] = useState(false);

  const holders = user?.premiumStarHolders || 5;
  const filled = user?.premiumStars || 3;
  const plan = user?.plan || 'premium';

  useEffect(() => {
    if (!user?.showPremiumWelcome) return undefined;
    const key = `premium-welcome-${user._id}-${user.loginCount}`;
    if (sessionStorage.getItem(key)) return undefined;
    sessionStorage.setItem(key, '1');
    setVisible(true);
    setPhase('animating');
    const t = setTimeout(() => setPhase('done'), 2800);
    return () => clearTimeout(t);
  }, [user?._id, user?.loginCount, user?.showPremiumWelcome]);

  if (!visible || !user?.showPremiumWelcome) return null;

  const dismiss = () => {
    setVisible(false);
    updateUser({ ...user, showPremiumWelcome: false });
  };

  return (
    <div className="premium-welcome-overlay" role="dialog" aria-labelledby="premium-welcome-title">
      <div className="premium-welcome-card">
        <button type="button" className="premium-welcome-close" onClick={dismiss} aria-label="Close">
          <X size={18} />
        </button>
        <div className="premium-welcome-badge">
          <Crown size={22} />
          <span>{plan === 'platinum' ? 'Platinum' : 'Premium'}</span>
        </div>
        <h2 id="premium-welcome-title">
          {plan === 'platinum' ? 'A warm welcome, Platinum member' : 'Welcome, Premium member'}
        </h2>
        <p className="premium-welcome-sub">
          You have full Premium access through March 15, 2027. Enjoy SortLife at its best.
        </p>
        <div className={`premium-stars ${phase}`} style={{ '--holders': holders }}>
          {Array.from({ length: holders }).map((_, i) => (
            <div key={i} className="premium-star-holder">
              {i < filled && (
                <span
                  className="premium-star-flying"
                  style={{ '--i': i, '--delay': `${0.35 + i * 0.28}s` }}
                  aria-hidden
                >
                  ★
                </span>
              )}
              <span className={`premium-star-slot ${i < filled && phase !== 'idle' ? 'filled' : ''}`}>
                {i < filled && phase === 'done' ? '★' : '☆'}
              </span>
            </div>
          ))}
        </div>
        <p className="premium-welcome-meta">{filled} of {holders} stars · Premium tier</p>
        <button type="button" className="btn btn-primary" onClick={dismiss}>
          Continue to SortLife
        </button>
      </div>
    </div>
  );
}
