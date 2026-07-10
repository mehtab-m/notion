import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Grid2x2, Github, Twitter, Mail } from 'lucide-react';
import AnimatedButton from './AnimatedButton';

const FOOTER_LINKS = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'About', href: '#about' },
  ],
  Account: [
    { label: 'Log in', to: '/login' },
    { label: 'Sign up', to: '/signup' },
    { label: 'Get Started', to: '/signup' },
  ],
};

export default function LandingFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl bg-gradient-to-r from-brand-500 to-brand-700 px-8 py-10 text-center text-white shadow-glow sm:px-12"
        >
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to get organized?</h2>
          <p className="mx-auto mt-3 max-w-lg text-brand-100">
            Join SortLife today and bring your notes, habits, and goals into one calm workspace.
          </p>
          <div className="mt-6 flex justify-center">
            <AnimatedButton to="/signup" variant="ghost" className="!bg-white !text-brand-600 hover:!bg-brand-50">
              Get Started Free
            </AnimatedButton>
          </div>
        </motion.div>

        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
                <Grid2x2 size={16} />
              </div>
              <span className="font-bold text-gray-900">SortLife</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              A personal productivity workspace for notes, habits, goals, and more.
            </p>
            <div className="mt-4 flex gap-3">
              {[Github, Twitter, Mail].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                  aria-label="Social link"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold text-gray-900">{title}</h4>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to} className="text-sm text-gray-500 transition-colors hover:text-brand-600">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="text-sm text-gray-500 transition-colors hover:text-brand-600">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="font-semibold text-gray-900">Legal</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-gray-500">
              <li><a href="#" className="hover:text-brand-600">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-brand-600">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-gray-100 pt-8 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} SortLife. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
