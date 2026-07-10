import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import AnimatedButton from './AnimatedButton';
import FloatingIcons from './FloatingIcons';

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28 lg:pt-40 lg:pb-32">
      <div className="absolute inset-0 bg-gradient-to-b from-pastel-lavender/60 via-white to-pastel-sky/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.12),_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.08),_transparent_50%)]" />

      <FloatingIcons />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-brand-600 shadow-soft backdrop-blur-sm"
          >
            <Sparkles size={14} />
            Your personal productivity workspace
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl"
          >
            Organize life.{' '}
            <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
              Build habits.
            </span>{' '}
            Stay focused.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg"
          >
            SortLife brings notebooks, sticky notes, habit tracking, goals, and custom tables
            into one beautiful workspace — so you can plan, track, and achieve more every day.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <AnimatedButton to="/signup" className="!px-8 !py-3.5 !text-base">
              Get Started Free
              <ArrowRight size={18} />
            </AnimatedButton>
            <AnimatedButton to="/login" variant="outline" className="!px-8 !py-3.5 !text-base">
              Log in
            </AnimatedButton>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-sm text-gray-500"
          >
            No credit card required · Free plan forever
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="relative mx-auto mt-16 max-w-4xl"
        >
          <div className="rounded-2xl border border-gray-200/80 bg-white p-2 shadow-card sm:rounded-3xl sm:p-3">
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white sm:rounded-2xl">
              <div className="flex items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs text-gray-400">SortLife — Dashboard</span>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:gap-4 sm:p-6">
                {[
                  { label: 'Habits', value: '5 active', color: 'bg-pastel-peach' },
                  { label: 'Notes', value: '12 pages', color: 'bg-pastel-lavender' },
                  { label: 'Goals', value: '3 in progress', color: 'bg-pastel-mint' },
                  { label: 'Tables', value: '2 boards', color: 'bg-pastel-sky' },
                ].map((card, i) => (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className={`rounded-xl p-4 ${card.color}`}
                  >
                    <p className="text-xs font-medium text-gray-500">{card.label}</p>
                    <p className="mt-1 text-sm font-bold text-gray-800">{card.value}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
