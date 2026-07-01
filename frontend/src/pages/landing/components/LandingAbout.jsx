import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, LayoutDashboard } from 'lucide-react';

const POINTS = [
  'All-in-one workspace for notes, habits, and goals',
  'Floating sticky notes that stay visible as you work',
  'Custom tables for subscriptions, tasks, and more',
  'Light, clean interface designed for focus',
];

export default function LandingAbout() {
  return (
    <section id="about" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-sm font-semibold uppercase tracking-wider text-brand-500">About</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to stay organized
            </h2>
            <p className="mt-5 text-base leading-relaxed text-gray-600 sm:text-lg">
              My Notion is a personal productivity hub inspired by the best of Notion —
              but built for your daily rituals. Track Namaz and reading habits, jot quick
              sticky notes, manage books and shows, and build custom data tables without
              the complexity.
            </p>
            <ul className="mt-8 space-y-4">
              {POINTS.map((point, i) => (
                <motion.li
                  key={point}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-brand-500" />
                  <span className="text-gray-700">{point}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-100 to-pastel-mint opacity-60 blur-2xl" />
            <div className="relative rounded-2xl border border-gray-200 bg-gradient-to-br from-pastel-lavender to-white p-8 shadow-card sm:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-glow">
                <LayoutDashboard size={28} />
              </div>
              <h3 className="mt-6 text-xl font-bold text-gray-900">Built for real life</h3>
              <p className="mt-3 text-gray-600 leading-relaxed">
                Whether you are tracking daily prayers, building a reading list, or
                managing project tasks — My Notion adapts to how you actually work,
                on mobile and desktop.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                {[
                  { stat: '10+', label: 'Modules' },
                  { stat: '7-day', label: 'Habit view' },
                  { stat: '∞', label: 'Sticky notes' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-white/80 p-3 shadow-soft">
                    <p className="text-lg font-bold text-brand-600">{item.stat}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
