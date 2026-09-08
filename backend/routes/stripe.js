const express = require('express');
const prisma = require('../lib/prisma');
const stripe = require('../services/stripe');

const router = express.Router();

/*
 * Stripe Price IDs
 *
 * These are the four PAID plans currently created
 * in your Stripe Sandbox/Test environment.
 */
const PRICE_IDS = {
  premium_monthly: 'price_1UBbHrA0R2kcKEnQhtPsMbnt',
  premium_yearly: 'price_1UBbNsA0R2kcKEnQ4e6HHvYS',
  platinum_monthly: 'price_1UBbOSA0R2kcKEnQJTobQMoG',
  platinum_yearly: 'price_1UBbP0A0R2kcKEnQoBdouDO8',
};

/*
 * GET /api/stripe/test
 *
 * Simple route to confirm that the Stripe router
 * is mounted correctly.
 */
router.get('/test', (req, res) => {
  res.json({
    ok: true,
    message: 'Stripe routes are working',
  });
});

/*
 * POST /api/stripe/create-subscription
 *
 * Creates a Stripe subscription for the authenticated user.
 *
 * Expected body:
 * {
 *   "plan": "premium",
 *   "billing": "monthly"
 * }
 *
 * OR:
 *
 * {
 *   "plan": "premium",
 *   "billing": "yearly"
 * }
 */
router.post('/create-subscription', async (req, res, next) => {
  try {
    const { plan, billing } = req.body;

    /*
     * Validate plan.
     */
    const allowedPlans = ['premium', 'platinum'];

    if (!allowedPlans.includes(plan)) {
      return res.status(400).json({
        error: 'Invalid plan. Choose premium or platinum.',
      });
    }

    /*
     * Validate billing period.
     */
    const allowedBilling = ['monthly', 'yearly'];

    if (!allowedBilling.includes(billing)) {
      return res.status(400).json({
        error: 'Invalid billing period. Choose monthly or yearly.',
      });
    }

    /*
     * Convert the user's plan + billing choice
     * into one of our server-controlled Stripe Price IDs.
     *
     * The frontend NEVER sends an arbitrary Stripe Price ID.
     */
    const priceKey = `${plan}_${billing}`;
    const priceId = PRICE_IDS[priceKey];

    if (!priceId) {
      return res.status(400).json({
        error: 'This subscription option is not available.',
      });
    }

    /*
     * req.user comes from your existing authMiddleware.
     */
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    /*
     * Common is free.
     *
     * Therefore users should never create a Stripe
     * subscription for the Common plan.
     */
    if (plan === 'common') {
      return res.status(400).json({
        error: 'Common is the free plan and does not require payment.',
      });
    }

    /*
     * Check whether this user already has a Stripe subscription.
     */
    if (user.stripeSubscriptionId) {
      const existingSubscription = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId
      );

      const activeStatuses = [
        'active',
        'trialing',
        'past_due',
        'unpaid',
      ];

      if (activeStatuses.includes(existingSubscription.status)) {
        return res.status(409).json({
          error: 'You already have an active Stripe subscription.',
          subscriptionStatus: existingSubscription.status,
        });
      }
    }

    /*
     * Create a Stripe Customer if one doesn't exist.
     */
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user.id,
        },
      });

      customerId = customer.id;

      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          stripeCustomerId: customerId,
        },
      });
    }

    /*
     * Create the Stripe subscription.
     *
     * default_incomplete means Stripe creates the subscription
     * but requires the first payment to be completed.
     */
    const subscription = await stripe.subscriptions.create({
      customer: customerId,

      items: [
        {
          price: priceId,
        },
      ],

      payment_behavior: 'default_incomplete',

      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },

      metadata: {
        userId: user.id,
        plan,
        billing,
      },

      expand: ['latest_invoice.confirmation_secret'],
    });

    /*
     * Save the Stripe subscription information.
     *
     * IMPORTANT:
     * This does NOT grant Premium/Platinum access yet.
     *
     * The webhook will be responsible for confirming payment
     * and updating the user's actual plan.
     */
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: subscription.status,
        stripePriceId: priceId,
      },
    });

    /*
     * Payment Element needs the client secret.
     */
    const clientSecret =
      subscription.latest_invoice?.confirmation_secret?.client_secret;

    if (!clientSecret) {
      return res.status(500).json({
        error: 'Stripe did not return a payment client secret.',
      });
    }

    return res.status(200).json({
      success: true,
      subscriptionId: subscription.id,
      clientSecret,
      plan,
      billing,
      priceId,
      status: subscription.status,
    });
  } catch (error) {
    console.error('Stripe create-subscription error:', error);

    next(error);
  }
});

module.exports = router;