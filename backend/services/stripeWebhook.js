const prisma = require('../lib/prisma');
const stripe = require('./stripe');

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
}

/*
 * Stripe Price IDs
 *
 * These must match the Price IDs used when creating subscriptions.
 */
const PRICE_TO_PLAN = {
  price_1UBbHrA0R2kcKEnQhtPsMbnt: 'premium',
  price_1UBbNsA0R2kcKEnQ4e6HHvYS: 'premium',
  price_1UBbOSA0R2kcKEnQJTobQMoG: 'platinum',
  price_1UBbP0A0R2kcKEnQoBdouDO8: 'platinum',
};

/*
 * Convert a Stripe Unix timestamp into a JavaScript Date.
 */
function stripeDate(timestamp) {
  if (!timestamp) return null;
  return new Date(timestamp * 1000);
}

/*
 * Get the subscription's current billing-period end.
 *
 * Stripe exposes this on the subscription item.
 */
function getCurrentPeriodEnd(subscription) {
  const timestamp =
    subscription.items?.data?.[0]?.current_period_end;

  return stripeDate(timestamp);
}

/*
 * Determine which application plan belongs to a Stripe subscription.
 *
 * Metadata is our first choice because create-subscription writes:
 *
 * metadata: {
 *   userId,
 *   plan,
 *   billing
 * }
 *
 * Price ID is the fallback.
 */
function getPlanFromSubscription(subscription) {
  const metadataPlan = subscription.metadata?.plan;

  if (metadataPlan === 'premium' || metadataPlan === 'platinum') {
    return metadataPlan;
  }

  const priceId =
    subscription.items?.data?.[0]?.price?.id;

  return PRICE_TO_PLAN[priceId] || null;
}

/*
 * Find the SortLife user associated with the Stripe subscription.
 *
 * We prefer metadata.userId because it was written when the
 * subscription was created.
 *
 * Customer ID is the fallback.
 */
async function findUserForSubscription(subscription) {
  const userId = subscription.metadata?.userId;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) return user;
  }

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return null;

  return prisma.user.findUnique({
    where: {
      stripeCustomerId: customerId,
    },
  });
}

/*
 * Update the local user according to the current Stripe
 * subscription state.
 */
async function syncSubscription(subscription) {
  const user = await findUserForSubscription(subscription);

  if (!user) {
    console.warn(
      `Stripe webhook: no SortLife user found for subscription ${subscription.id}`
    );

    return;
  }

  const plan = getPlanFromSubscription(subscription);
  const currentPeriodEnd = getCurrentPeriodEnd(subscription);

  /*
   * Stripe subscription statuses.
   *
   * active:
   *   Payment/subscription is active.
   *
   * trialing:
   *   Subscription is currently in a trial.
   *
   * past_due:
   *   Payment failed, but Stripe may still retry.
   *
   * incomplete:
   *   Initial payment has not completed yet.
   *
   * incomplete_expired:
   *   Initial payment was not completed in time.
   *
   * unpaid:
   *   Stripe considers the invoice unpaid.
   *
   * canceled:
   *   Subscription has ended.
   */
  const status = subscription.status;

  /*
   * Only active/trialing subscriptions receive paid-plan
   * entitlement.
   *
   * We deliberately do NOT grant access for:
   * incomplete
   * incomplete_expired
   * unpaid
   * canceled
   *
   * For past_due, we keep the existing paid plan temporarily
   * because Stripe can retry the payment.
   */
  const isEntitled =
    status === 'active' ||
    status === 'trialing';

  /*
   * If Stripe has confirmed an active paid subscription,
   * grant the corresponding application plan.
   */
  if (isEntitled && plan) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        plan,
        planExpiresAt: currentPeriodEnd,

        stripeCustomerId:
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id || user.stripeCustomerId,

        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: status,

        stripePriceId:
          subscription.items?.data?.[0]?.price?.id ||
          user.stripePriceId,

        stripeCurrentPeriodEnd: currentPeriodEnd,

        stripeCancelAtPeriodEnd:
          subscription.cancel_at_period_end === true,
      },
    });

    console.log(
      `Stripe webhook: user ${user.id} -> ${plan} (${status})`
    );

    return;
  }

  /*
   * A past_due subscription remains on its current paid plan
   * while Stripe attempts payment recovery.
   *
   * We still update the Stripe status and billing information.
   */
  if (status === 'past_due') {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: status,

        stripePriceId:
          subscription.items?.data?.[0]?.price?.id ||
          user.stripePriceId,

        stripeCurrentPeriodEnd: currentPeriodEnd,

        stripeCancelAtPeriodEnd:
          subscription.cancel_at_period_end === true,
      },
    });

    console.log(
      `Stripe webhook: user ${user.id} payment is past_due`
    );

    return;
  }

  /*
   * If the subscription becomes unpaid, incomplete_expired,
   * or canceled, remove the paid entitlement.
   */
  if (
    status === 'unpaid' ||
    status === 'incomplete_expired' ||
    status === 'canceled'
  ) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        plan: 'common',
        planExpiresAt: null,

        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: status,

        stripePriceId:
          subscription.items?.data?.[0]?.price?.id ||
          user.stripePriceId,

        stripeCurrentPeriodEnd: currentPeriodEnd,

        stripeCancelAtPeriodEnd:
          subscription.cancel_at_period_end === true,
      },
    });

    console.log(
      `Stripe webhook: user ${user.id} -> common (${status})`
    );

    return;
  }

  /*
   * For incomplete subscriptions, update Stripe metadata locally
   * but DO NOT grant the paid plan.
   */
  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: status,

      stripePriceId:
        subscription.items?.data?.[0]?.price?.id ||
        user.stripePriceId,

      stripeCurrentPeriodEnd: currentPeriodEnd,

      stripeCancelAtPeriodEnd:
        subscription.cancel_at_period_end === true,
    },
  });

  console.log(
    `Stripe webhook: user ${user.id} subscription status = ${status}`
  );
}

/*
 * Handle a Stripe webhook request.
 *
 * IMPORTANT:
 * req.body must be the raw Buffer.
 */
async function handleStripeWebhook(req, res) {
  if (!WEBHOOK_SECRET) {
    console.error('Stripe webhook secret is missing');
    return res.status(500).json({
      error: 'Stripe webhook is not configured',
    });
  }

  const signature = req.headers['stripe-signature'];

  if (!signature) {
    return res.status(400).json({
      error: 'Missing Stripe signature',
    });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      WEBHOOK_SECRET
    );
  } catch (error) {
    console.error(
      'Stripe webhook signature verification failed:',
      error.message
    );

    return res.status(400).json({
      error: 'Invalid Stripe webhook signature',
    });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object);
        break;
      }

      case 'invoice.paid': {
        /*
         * invoice.paid confirms successful payment.
         *
         * We retrieve the subscription so we can synchronize
         * the application's entitlement from the authoritative
         * Stripe subscription object.
         */
        const invoice = event.data.object;

        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(
              subscriptionId
            );

          await syncSubscription(subscription);
        }

        break;
      }

      case 'invoice.payment_failed': {
        /*
         * Payment failure does not immediately remove access.
         *
         * Stripe may retry the payment. The subscription
         * status will be synchronized through subscription
         * webhook events.
         */
        const invoice = event.data.object;

        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(
              subscriptionId
            );

          await syncSubscription(subscription);
        }

        break;
      }

      default:
        console.log(
          `Stripe webhook: ignored event ${event.type}`
        );
    }

    /*
     * Stripe expects a successful HTTP response.
     */
    return res.json({
      received: true,
    });
  } catch (error) {
    console.error(
      `Stripe webhook processing failed for ${event.type}:`,
      error
    );

    /*
     * Return 500 so Stripe knows it should retry the webhook.
     */
    return res.status(500).json({
      error: 'Webhook processing failed',
    });
  }
}

module.exports = {
  handleStripeWebhook,
};