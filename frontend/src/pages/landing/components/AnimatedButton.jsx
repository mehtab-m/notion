import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const variants = {
  primary:
    'bg-brand-500 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600',
  outline:
    'border-2 border-brand-500 text-brand-600 bg-white hover:bg-brand-50',
  ghost:
    'text-brand-600 bg-brand-50 hover:bg-brand-100',
  dark:
    'bg-gray-900 text-white shadow-lg hover:bg-gray-800',
};

export default function AnimatedButton({
  to,
  href,
  children,
  variant = 'primary',
  className = '',
  onClick,
  type = 'button',
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${variants[variant]} ${className}`;

  const motionProps = {
    whileHover: { scale: 1.04, y: -1 },
    whileTap: { scale: 0.97 },
    transition: { type: 'spring', stiffness: 400, damping: 20 },
  };

  if (to) {
    return (
      <motion.div {...motionProps} className="inline-block">
        <Link to={to} className={classes}>
          {children}
        </Link>
      </motion.div>
    );
  }

  if (href) {
    return (
      <motion.a href={href} className={classes} {...motionProps}>
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button type={type} className={classes} onClick={onClick} {...motionProps}>
      {children}
    </motion.button>
  );
}
