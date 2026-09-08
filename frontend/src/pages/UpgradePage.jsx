import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  Crown,
  Sparkles,
  Palette,
  Minus,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  THEMES,
  FREE_THEMES,
  PLATINUM_THEMES,
} from '../theme/catalog';

import './UpgradePage.css';

/* Feature comparison matrix */
const FEATURES = [
  {
    label: 'Notes, goals, habits, books, shows, tables',
    common: true,
    premium: true,
    platinum: true,
  },
  {
    label: 'Quick capture inbox & focus timer',
    common: true,
    premium: true,
    platinum: true,
  },
  {
    label: 'Insights, heatmaps & weekly recap',
    common: true,
    premium: true,
    platinum: true,
  },
  {
    label: 'Archive, trash & restore',
    common: true,
    premium: true,
    platinum: true,
  },
  {
    label: 'Export everything (JSON + CSV)',
    common: true,
    premium: true,
    platinum: true,
  },
  {
    label: 'Themes',
    common: '3',
    premium: '3',
    platinum: `${THEMES.length} + custom`,
  },
  {
    label: 'Custom theme builder',
    common: false,
    premium: false,
    platinum: true,
  },
  {
    label: 'Saved palettes',
    common: false,
    premium: false,
    platinum: 'Up to 12',
  },
  {
    label: 'Density & font-size control',
    common: true,
    premium: true,
    platinum: true,
  },
  {
    label: 'Shared projects & team invites',
    common: false,
    premium: true,
    platinum: true,
  },
  {
    label: 'Priority support',
    common: false,
    premium: false,
    platinum: true,
  },
];

const PLANS = [
  {
    id: 'common',
    name: 'Common',
    price: 'Free',
    note: 'Everything you need to stay sorted.',
  },
  {
    id: 'premium',
    name: 'Premium',
    monthly: '$5',
    yearly: '$50',
    note: 'More collaboration and productivity features.',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    monthly: '$10',
    yearly: '$100',
    note: 'The complete SortLife experience with every theme.',
    highlight: true,
  },
];

function Cell({ value }) {
  if (value === true) {
    return (
      <Check
        size={15}
        className="matrix-yes"
        aria-label="Included"
      />
    );
  }

  if (value === false) {
    return (
      <Minus
        size={15}
        className="matrix-no"
        aria-label="Not included"
      />
    );
  }

  return (
    <span className="matrix-text">
      {value}
    </span>
  );
}

export default function UpgradePage() {
  const { user, plan } = useAuth();
  const { setTheme, canUse } = useTheme();
  const navigate = useNavigate();

  const handleSubscribe = (selectedPlan, billing) => {
    navigate('/stripe-payment', {
      state: {
        plan: selectedPlan,
        billing,
      },
    });
  };

  return (
    <div className="upgrade-page page-enter">

      {/* ───────────────────────── HERO ───────────────────────── */}

      <header className="upgrade-hero">
        <span className="upgrade-eyebrow">
          <Sparkles size={13} />
          Plans
        </span>

        <h1>
          Choose the SortLife plan that fits you.
        </h1>

        <p>
          Start with Common for free, or unlock Premium and
          Platinum with a secure Stripe subscription.
        </p>

        <div className="upgrade-hero-badges">

          <span className={`upgrade-current plan-${plan}`}>
            <Crown size={13} />

            You are on{' '}

            {plan === 'platinum'
              ? 'Platinum'
              : plan === 'premium'
                ? 'Premium'
                : 'Common'}
          </span>

          {user?.planExpiresAt && plan !== 'common' && (
            <span className="upgrade-until">
              through{' '}
              {new Date(
                user.planExpiresAt
              ).toLocaleDateString()}
            </span>
          )}

        </div>
      </header>


      {/* ───────────────────── PLAN CARDS ───────────────────── */}

      <section className="upgrade-plan-cards">

        {/* COMMON */}

        <article
          className={`upgrade-plan-card ${
            plan === 'common'
              ? 'is-current'
              : ''
          }`}
        >
          <div className="upgrade-plan-card-header">
            <h2>Common</h2>

            <span className="upgrade-price">
              Free
            </span>
          </div>

          <p>
            Everything you need to stay organized.
          </p>

          {plan === 'common' && (
            <span className="matrix-plan-current">
              Current plan
            </span>
          )}
        </article>


        {/* PREMIUM */}

        <article
          className={`upgrade-plan-card ${
            plan === 'premium'
              ? 'is-current'
              : ''
          }`}
        >
          <div className="upgrade-plan-card-header">
            <h2>Premium</h2>

            {plan === 'premium' && (
              <span className="matrix-plan-current">
                Current
              </span>
            )}
          </div>

          <div className="upgrade-price">
            <strong>$5</strong>
            <span>/ month</span>
          </div>

          <div className="upgrade-yearly-price">
            or $50 / year
          </div>

          <p>
            Unlock collaboration and additional
            productivity features.
          </p>

          {plan !== 'premium' && plan !== 'platinum' ? (
            <div className="upgrade-card-actions">

              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  handleSubscribe(
                    'premium',
                    'monthly'
                  )
                }
              >
                Subscribe $5/month
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  handleSubscribe(
                    'premium',
                    'yearly'
                  )
                }
              >
                Subscribe $50/year
              </button>

            </div>
          ) : null}

        </article>


        {/* PLATINUM */}

        <article
          className={`upgrade-plan-card ${
            plan === 'platinum'
              ? 'is-current'
              : ''
          } ${'is-highlight'}`}
        >
          <div className="upgrade-plan-card-header">

            <h2>
              <Crown size={16} />
              Platinum
            </h2>

            {plan === 'platinum' && (
              <span className="matrix-plan-current">
                Current
              </span>
            )}

          </div>

          <div className="upgrade-price">
            <strong>$10</strong>
            <span>/ month</span>
          </div>

          <div className="upgrade-yearly-price">
            or $100 / year
          </div>

          <p>
            Get the complete SortLife experience,
            including all themes and premium features.
          </p>

          {plan !== 'platinum' && (
            <div className="upgrade-card-actions">

              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  handleSubscribe(
                    'platinum',
                    'monthly'
                  )
                }
              >
                Subscribe $10/month
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  handleSubscribe(
                    'platinum',
                    'yearly'
                  )
                }
              >
                Subscribe $100/year
              </button>

            </div>
          )}

        </article>

      </section>


      {/* ───────────────────── THEMES ───────────────────── */}

      <section className="upgrade-themes">

        <div className="section-head">
          <h2>
            <Palette size={16} />
            The nine themes
          </h2>

          <Link
            to="/settings#appearance"
            className="section-head-sub"
          >
            Open appearance settings
          </Link>
        </div>


        <div className="upgrade-theme-row">

          <h3>
            Included on every plan
          </h3>

          <div className="upgrade-theme-grid">

            {FREE_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className="upgrade-theme"
                onClick={() =>
                  setTheme(theme.id)
                }
                title={`Apply ${theme.label}`}
              >
                <span className="upgrade-theme-preview">

                  {theme.swatch.map(
                    (color, i) => (
                      <i
                        key={i}
                        style={{
                          background: color,
                        }}
                      />
                    )
                  )}

                </span>

                <strong>
                  {theme.label}
                </strong>

                <span>
                  {theme.description}
                </span>

              </button>
            ))}

          </div>
        </div>


        <div className="upgrade-theme-row">

          <h3>
            Platinum only

            <span className="lock-pill">
              <Crown size={11} />
              Platinum
            </span>
          </h3>

          <div className="upgrade-theme-grid">

            {PLATINUM_THEMES.map(
              (theme) => {

                const allowed =
                  canUse(theme.id);

                return (
                  <button
                    key={theme.id}
                    type="button"
                    className={`upgrade-theme ${
                      allowed
                        ? ''
                        : 'is-locked'
                    }`}
                    onClick={() =>
                      allowed &&
                      setTheme(theme.id)
                    }
                    title={
                      allowed
                        ? `Apply ${theme.label}`
                        : `${theme.label} needs Platinum`
                    }
                  >

                    <span className="upgrade-theme-preview">

                      {theme.swatch.map(
                        (color, i) => (
                          <i
                            key={i}
                            style={{
                              background: color,
                            }}
                          />
                        )
                      )}

                    </span>

                    <strong>
                      {theme.label}
                    </strong>

                    <span>
                      {theme.description}
                    </span>

                  </button>
                );
              }
            )}

          </div>
        </div>


        {plan !== 'platinum' && (
          <div className="upgrade-custom-teaser">

            <div>

              <strong>
                Build your own
              </strong>

              <p>
                Platinum unlocks a full palette
                editor — sixteen tokens, live preview,
                and up to twelve saved themes that
                follow you to any device.
              </p>

            </div>

            <span
              className="upgrade-custom-swatches"
              aria-hidden
            >
              {[
                '#4F46E5',
                '#2DD4BF',
                '#EA580C',
                '#DB2777',
                '#4ADE80',
                '#88C0D0',
              ].map((c) => (
                <i
                  key={c}
                  style={{
                    background: c,
                  }}
                />
              ))}
            </span>

          </div>
        )}

      </section>


      {/* ───────────────────── COMPARISON ───────────────────── */}

      <section className="upgrade-matrix-wrap">

        <div className="section-head">
          <h2>
            What each plan includes
          </h2>
        </div>

        <div className="table-scroll-wrap">

          <table className="upgrade-matrix">

            <thead>

              <tr>

                <th scope="col">
                  Feature
                </th>

                {PLANS.map((p) => (

                  <th
                    key={p.id}
                    scope="col"
                    className={`${
                      p.highlight
                        ? 'is-highlight'
                        : ''
                    } ${
                      plan === p.id
                        ? 'is-current'
                        : ''
                    }`}
                  >

                    <span className="matrix-plan-name">

                      {p.highlight && (
                        <Crown size={12} />
                      )}

                      {p.name}

                    </span>

                    <span className="matrix-plan-price">

                      {p.id === 'common'
                        ? 'Free'
                        : p.id === 'premium'
                          ? '$5/mo · $50/yr'
                          : '$10/mo · $100/yr'}

                    </span>

                    {plan === p.id && (
                      <span className="matrix-plan-current">
                        Current
                      </span>
                    )}

                  </th>

                ))}

              </tr>

            </thead>

            <tbody>

              {FEATURES.map((feature) => (

                <tr key={feature.label}>

                  <th scope="row">
                    {feature.label}
                  </th>

                  <td>
                    <Cell
                      value={feature.common}
                    />
                  </td>

                  <td>
                    <Cell
                      value={feature.premium}
                    />
                  </td>

                  <td className="is-highlight">
                    <Cell
                      value={feature.platinum}
                    />
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>


        {PLANS.map((p) => (

          <p
            key={p.id}
            className="upgrade-plan-note"
          >

            <strong>
              {p.name}
            </strong>{' '}

            — {p.note}

          </p>

        ))}

      </section>


      {/* ───────────────────── BOTTOM CTA ───────────────────── */}

      <section className="upgrade-cta">

        {plan === 'platinum' ? (

          <>
            <h2>
              You already have everything.
            </h2>

            <p>
              All nine themes are unlocked,
              and the palette builder is waiting.
            </p>

            <Link
              to="/settings#appearance"
              className="btn btn-primary btn-lg"
            >
              <Palette size={16} />
              Open the theme studio
            </Link>
          </>

        ) : plan === 'premium' ? (

          <>
            <h2>
              Ready for Platinum?
            </h2>

            <p>
              Upgrade to Platinum to unlock
              every theme and the complete
              customization experience.
            </p>

            <div className="upgrade-cta-actions">

              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() =>
                  handleSubscribe(
                    'platinum',
                    'monthly'
                  )
                }
              >
                <Crown size={16} />
                Upgrade to Platinum
              </button>

              <Link
                to="/settings#appearance"
                className="btn btn-secondary btn-lg"
              >
                See my current themes
              </Link>

            </div>
          </>

        ) : (

          <>
            <h2>
              Unlock more with Premium or Platinum.
            </h2>

            <p>
              Choose monthly or yearly billing.
              Payments are securely processed by
              Stripe.
            </p>

            <div className="upgrade-cta-actions">

              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() =>
                  handleSubscribe(
                    'premium',
                    'monthly'
                  )
                }
              >
                Subscribe Premium
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={() =>
                  handleSubscribe(
                    'platinum',
                    'monthly'
                  )
                }
              >
                <Crown size={16} />
                Subscribe Platinum
              </button>

            </div>
          </>

        )}

      </section>

    </div>
  );
}