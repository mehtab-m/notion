import React from 'react';
import { motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';
import AnimatedButton from './AnimatedButton';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Perfect for getting started with personal productivity.',
    features: [
      'Notebook & sticky notes',
      'Habit tracker (5 habits)',
      'Goals & basic tables',
      'Books & shows library',
      'Mobile-friendly layout',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Premium',
    price: '$9',
    period: '/month',
    desc: 'For power users who want more space and features.',
    features: [
      'Everything in Free',
      'Unlimited habits & goals',
      'Unlimited custom tables',
      'Project collaboration',
      'Priority email support',
      'Advanced dashboard charts',
    ],
    cta: 'Get Started',
    highlighted: true,
  },
  {
    name: 'Platinum',
    price: '$19',
    period: '/month',
    desc: 'Full workspace for teams and serious organizers.',
    features: [
      'Everything in Premium',
      'Team projects & chat',
      'Shared tables & invites',
      'Export & backup tools',
      'Custom habit templates',
      'Dedicated support',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
];

export default function LandingPricing() {
  return (
    <section id="pricing" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-500">Pricing</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Simple, transparent plans
          </h2>
          <p className="mt-4 text-gray-600">
            Start free and upgrade when you need more. No hidden fees.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:gap-8">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              whileHover={{ y: plan.highlighted ? -8 : -4 }}
              className={`relative flex flex-col rounded-2xl border p-8 transition-shadow ${
                plan.highlighted
                  ? 'border-brand-400 bg-gradient-to-b from-brand-50 to-white shadow-glow ring-2 ring-brand-500/20'
                  : 'border-gray-200 bg-white shadow-soft hover:shadow-card'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand-500 px-4 py-1 text-xs font-semibold text-white shadow-md">
                  <Star size={12} fill="currentColor" />
                  Recommended
                </div>
              )}

              <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                <span className="text-gray-500">{plan.period}</span>
              </div>
              <p className="mt-3 text-sm text-gray-600">{plan.desc}</p>

              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <Check size={16} className="mt-0.5 shrink-0 text-brand-500" />
                    {feat}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <AnimatedButton
                  to="/signup"
                  variant={plan.highlighted ? 'primary' : 'outline'}
                  className="w-full !py-3"
                >
                  {plan.cta}
                </AnimatedButton>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
