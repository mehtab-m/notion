import { useState } from 'react';
import {
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';

import './StripeCheckout.css';

export default function StripeCheckout({ onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/upgrade`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'Payment failed.');
      setLoading(false);
      return;
    }

    setLoading(false);

    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <form
      className="stripe-checkout-form"
      onSubmit={handleSubmit}
    >
      <div className="stripe-payment-element">
        <PaymentElement />
      </div>

      {errorMessage && (
        <div className="stripe-error" role="alert">
          <span className="stripe-error-icon">!</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <button
        type="submit"
        className="stripe-pay-button"
        disabled={!stripe || !elements || loading}
      >
        {loading ? (
          <>
            <span className="stripe-spinner" />
            Processing payment...
          </>
        ) : (
          <>
            Pay & Subscribe
            <span className="stripe-button-arrow">→</span>
          </>
        )}
      </button>

      <div className="stripe-secure-note">
        <span>🔒</span>
        <span>
          Secure payment powered by Stripe
        </span>
      </div>
    </form>
  );
}