import React, { useEffect, useState } from 'react';
import './ProgressRing.css';

export default function ProgressRing({ percent = 0, size = 60, color = 'var(--accent)', label }) {
  const [animated, setAnimated] = useState(0);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(percent), 100);
    return () => clearTimeout(timer);
  }, [percent]);

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-hover)"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="progress-ring-label">
        <span className="progress-ring-percent">{Math.round(percent)}%</span>
        {label && <span className="progress-ring-text">{label}</span>}
      </div>
    </div>
  );
}
