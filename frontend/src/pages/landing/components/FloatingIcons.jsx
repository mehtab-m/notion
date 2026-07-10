import React from 'react';
import { motion } from 'framer-motion';
import {
  StickyNote, Flame, BookOpen, Table, Target, PenLine, FolderKanban, Grid2x2,
} from 'lucide-react';

const ICONS = [
  { Icon: StickyNote, color: '#fde047', bg: '#fef9c3', x: '8%', y: '18%', delay: 0, size: 28 },
  { Icon: Flame, color: '#f59e0b', bg: '#ffedd5', x: '85%', y: '12%', delay: 0.4, size: 32 },
  { Icon: BookOpen, color: '#10b981', bg: '#dcfce7', x: '78%', y: '55%', delay: 0.8, size: 26 },
  { Icon: Table, color: '#3b82f6', bg: '#dbeafe', x: '12%', y: '62%', delay: 1.2, size: 30 },
  { Icon: Target, color: '#8b5cf6', bg: '#f3e8ff', x: '92%', y: '38%', delay: 0.6, size: 24 },
  { Icon: PenLine, color: '#6366f1', bg: '#e0e7ff', x: '5%', y: '42%', delay: 1.0, size: 26 },
  { Icon: FolderKanban, color: '#ec4899', bg: '#fce7f3', x: '68%', y: '22%', delay: 1.4, size: 28 },
  { Icon: Grid2x2, color: '#6366f1', bg: '#eef2ff', x: '22%', y: '78%', delay: 0.2, size: 34 },
];

export default function FloatingIcons() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {ICONS.map(({ Icon, color, bg, x, y, delay, size }, i) => (
        <motion.div
          key={i}
          className="absolute flex items-center justify-center rounded-2xl shadow-soft"
          style={{
            left: x,
            top: y,
            width: size + 24,
            height: size + 24,
            background: bg,
          }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{
            opacity: [0.5, 0.85, 0.5],
            y: [0, -14, 0],
            rotate: [0, i % 2 === 0 ? 6 : -6, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 4 + i * 0.3,
            repeat: Infinity,
            ease: 'easeInOut',
            delay,
          }}
        >
          <Icon size={size} color={color} strokeWidth={1.75} />
        </motion.div>
      ))}
    </div>
  );
}
