import { useEffect, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useLocation, useNavigate } from 'react-router-dom';

import StripeCheckout from '../components/StripeCheckout';
import { createStripeSubscription } from '../utils/api';

import './StripePaymentPage.css';

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
);

export default function StripePaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const plan = location.state?.plan;
  const billing = location.state?.billing;

  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!plan || !billing) {
      setErrorMessage('Invalid subscription selection.');
      setLoading(false);
      return;
    }

    const createSubscription = async () => {
      try {
        const data = await createStripeSubscription({
          plan,
          billing,
        });

        if (!data?.clientSecret) {
          throw new Error(
            'Stripe did not return a client secret.'
          );
        }

        setClientSecret(data.clientSecret);
      } catch (error) {
        console.error(
          'Stripe subscription error:',
          error
        );

        setErrorMessage(
          error.response?.data?.error ||
            error.message ||
            'Unable to create subscription.'
        );
      } finally {
        setLoading(false);
      }
    };

    createSubscription();
  }, [plan, billing]);

  const planName =
    plan === 'premium' ? 'Premium' : 'Platinum';

  const billingName =
    billing === 'monthly' ? 'Monthly' : 'Yearly';

  const price =
    plan === 'premium'
      ? billing === 'monthly'
        ? '$5'
        : '$50'
      : billing === 'monthly'
        ? '$10'
        : '$100';

  /* ───────────────── LOADING ───────────────── */

  if (loading) {
    return (
      <div className="stripe-page">
        <div className="stripe-payment-shell">
          <div className="stripe-loading-card">
            <div className="stripe-spinner" />

            <h1>
              Preparing secure payment
            </h1>

            <p>
              We are securely preparing your
              {` ${planName}`} subscription.
            </p>

            <span>
              Please wait a moment...
            </span>
          </div>
        </div>
      </div>
    );
  }

  /* ───────────────── ERROR ───────────────── */

  if (errorMessage) {
    return (
      <div className="stripe-page">
        <div className="stripe-payment-shell">
          <div className="stripe-error-card">

            <div className="stripe-error-icon">
              !
            </div>

            <h1>
              Payment couldn't be prepared
            </h1>

            <p>
              {errorMessage}
            </p>

            <button
              type="button"
              className="stripe-back-button"
              onClick={() => navigate('/upgrade')}
            >
              Back to Plans
            </button>

          </div>
        </div>
      </div>
    );
  }

  /* ───────────────── NO CLIENT SECRET ───────────────── */

  if (!clientSecret) {
    return (
      <div className="stripe-page">
        <div className="stripe-payment-shell">
          <div className="stripe-error-card">

            <div className="stripe-error-icon">
              !
            </div>

            <h1>
              Unable to initialize payment
            </h1>

            <p>
              Stripe could not initialize the
              payment form. Please return to the
              plans page and try again.
            </p>

            <button
              type="button"
              className="stripe-back-button"
              onClick={() => navigate('/upgrade')}
            >
              Back to Plans
            </button>

          </div>
        </div>
      </div>
    );
  }

  /* ───────────────── PAYMENT PAGE ───────────────── */

  return (
    <div className="stripe-page">

      <div className="stripe-payment-shell">

        {/* BACK BUTTON */}

        <button
          type="button"
          className="stripe-back-link"
          onClick={() => navigate('/upgrade')}
        >
          ← Back to plans
        </button>


        {/* HEADER */}

        <div className="stripe-page-header">

          <div className="stripe-secure-badge">
            <span className="stripe-lock">
              ✓
            </span>

            Secure checkout
          </div>

          <h1>
            Complete your subscription
          </h1>

          <p>
            Finish your payment securely with Stripe.
            Your subscription will activate automatically
            after successful payment.
          </p>

        </div>


        {/* MAIN CONTENT */}

        <div className="stripe-checkout-grid">

          {/* LEFT — PAYMENT */}

          <div className="stripe-payment-card">

            <div className="stripe-card-header">

              <div>
                <h2>
                  Payment details
                </h2>

                <p>
                  Enter your payment information below.
                </p>
              </div>

              <div className="stripe-powered">
                <span>Powered by</span>
                <strong>stripe</strong>
              </div>

            </div>

            <div className="stripe-checkout-container">

              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#4f46e5',
                      colorBackground: '#ffffff',
                      colorText: '#111827',
                      colorTextSecondary: '#6b7280',
                      colorDanger: '#dc2626',
                      borderRadius: '10px',
                      fontFamily:
                        'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    },
                    rules: {
                      '.Input': {
                        border: '1px solid #d1d5db',
                        boxShadow: 'none',
                      },
                      '.Input:focus': {
                        border:
                          '1px solid #4f46e5',
                        boxShadow:
                          '0 0 0 3px rgba(79, 70, 229, 0.12)',
                      },
                      '.Label': {
                        fontWeight: '600',
                      },
                    },
                  },
                }}
              >
                <StripeCheckout
                  plan={plan}
                  billing={billing}
                  onSuccess={() => {
                    navigate(
                      '/upgrade?payment=success'
                    );
                  }}
                />
              </Elements>

            </div>

          </div>


          {/* RIGHT — ORDER SUMMARY */}

          <aside className="stripe-order-card">

            <div className="stripe-order-header">
              <span>Subscription</span>
              <span className="stripe-checkmark">
                ✓
              </span>
            </div>


            <div
              className={`stripe-plan-icon stripe-plan-${plan}`}
            >
              {plan === 'platinum' ? '♛' : '✦'}
            </div>


            <h2>
              {planName}
            </h2>

            <p className="stripe-plan-description">

              {plan === 'premium'
                ? 'Unlock collaboration and additional productivity features.'
                : 'Get the complete SortLife experience with every theme and premium feature.'}

            </p>


            <div className="stripe-divider" />


            <div className="stripe-summary-row">
              <span>Plan</span>
              <strong>{planName}</strong>
            </div>

            <div className="stripe-summary-row">
              <span>Billing</span>
              <strong>{billingName}</strong>
            </div>


            <div className="stripe-divider" />


            <div className="stripe-total-row">
              <span>Total</span>

              <div>
                <strong>
                  {price}
                </strong>

                <small>
                  {billing === 'monthly'
                    ? '/ month'
                    : '/ year'}
                </small>
              </div>
            </div>


            <div className="stripe-secure-note">

              <span>🔒</span>

              <p>
                Your payment information is securely
                processed by Stripe. SortLife does not
                store your card details.
              </p>

            </div>

          </aside>

        </div>


        {/* FOOTER NOTE */}

        <div className="stripe-page-footer">

          <span>
            🔒 Secure payment
          </span>

          <span>
            •
          </span>

          <span>
            Stripe protected
          </span>

          <span>
            •
          </span>

          <span>
            Cancel anytime
          </span>

        </div>

      </div>

    </div>
  );
}