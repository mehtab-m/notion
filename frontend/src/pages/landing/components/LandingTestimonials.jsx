import React from 'react';
import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';

const TESTIMONIALS = [
  {
    name: 'Ayesha K.',
    role: 'Student',
    text: 'The habit tracker with Namaz and reading built in changed my daily routine. I finally stick to things.',
    stars: 5,
  },
  {
    name: 'Omar R.',
    role: 'Freelancer',
    text: 'Sticky notes on screen while I work, plus tables for client subscriptions — exactly what I needed.',
    stars: 5,
  },
  {
    name: 'Sarah M.',
    role: 'Product Manager',
    text: 'Clean, light UI that does not overwhelm. Projects, notes, and goals all in one place. Love it.',
    stars: 5,
  },
];

export default function LandingTestimonials() {
  return (
    <section id="testimonials" className="scroll-mt-24 bg-pastel-sky/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-500">Reviews</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Loved by organizers everywhere
          </h2>
        </motion.div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.blockquote
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="relative rounded-2xl border border-gray-200/80 bg-white p-6 shadow-soft transition-shadow hover:shadow-card"
            >
              <Quote size={28} className="text-brand-200" />
              <div className="mt-3 flex gap-0.5">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} size={14} className="fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-gray-700">&ldquo;{t.text}&rdquo;</p>
              <footer className="mt-5 border-t border-gray-100 pt-4">
                <p className="font-semibold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500">{t.role}</p>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
