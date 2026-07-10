import React from 'react';
import { motion } from 'framer-motion';
import {
  StickyNote, Flame, PenLine, Table, Target, BookOpen, FolderKanban, Tv,
} from 'lucide-react';

const FEATURES = [
  {
    icon: PenLine,
    title: 'Notebook',
    desc: 'Rich pages with blocks, images, and nested notebooks for deep notes.',
    color: 'from-pastel-lavender to-white',
    iconBg: 'bg-brand-100 text-brand-600',
  },
  {
    icon: StickyNote,
    title: 'Sticky Notes',
    desc: 'Colorful floating notes on your screen — hide, pin, or delete anytime.',
    color: 'from-pastel-peach to-white',
    iconBg: 'bg-amber-100 text-amber-600',
  },
  {
    icon: Flame,
    title: 'Habit Tracker',
    desc: 'Track daily habits with streaks. Pre-built habits like Namaz and reading.',
    color: 'from-pastel-rose to-white',
    iconBg: 'bg-orange-100 text-orange-600',
  },
  {
    icon: Target,
    title: 'Goals & Milestones',
    desc: 'Set goals with categories and tick off milestones as you progress.',
    color: 'from-pastel-mint to-white',
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
  {
    icon: Table,
    title: 'Custom Tables',
    desc: 'Spreadsheet-style boards with columns, dropdowns, and inline editing.',
    color: 'from-pastel-sky to-white',
    iconBg: 'bg-blue-100 text-blue-600',
  },
  {
    icon: BookOpen,
    title: 'Books & Shows',
    desc: 'Track what you read and watch with progress bars and status filters.',
    color: 'from-pastel-lavender to-white',
    iconBg: 'bg-violet-100 text-violet-600',
  },
  {
    icon: FolderKanban,
    title: 'Projects',
    desc: 'Kanban tasks, team invites, chat, and project-scoped tables.',
    color: 'from-pastel-peach to-white',
    iconBg: 'bg-pink-100 text-pink-600',
  },
  {
    icon: Tv,
    title: 'Dashboard',
    desc: 'One glance at your stats, charts, and recent activity across everything.',
    color: 'from-pastel-sky to-white',
    iconBg: 'bg-cyan-100 text-cyan-600',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export default function LandingFeatures() {
  return (
    <section id="features" className="scroll-mt-24 bg-pastel-lavender/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-500">Features</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Powerful tools, beautifully simple
          </h2>
          <p className="mt-4 text-gray-600">
            Every module works together so you never lose context between planning and doing.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((feat) => (
            <motion.div
              key={feat.title}
              variants={item}
              whileHover={{ y: -6, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`group rounded-2xl border border-gray-200/80 bg-gradient-to-br ${feat.color} p-6 shadow-soft transition-shadow hover:shadow-card`}
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${feat.iconBg}`}>
                <feat.icon size={22} strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 font-bold text-gray-900">{feat.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{feat.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
