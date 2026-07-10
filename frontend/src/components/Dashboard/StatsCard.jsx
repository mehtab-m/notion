import React from 'react';
import './StatsCard.css';

export default function StatsCard({ icon: Icon, label, value, subLabel, color }) {
  return (
    <div className="stats-card" style={{ '--card-color': color }}>
      <div className="stats-card-left">
        <div className="stats-card-icon">
          <Icon size={20} color={color} />
        </div>
        <div className="stats-card-info">
          <span className="stats-card-value">{value}</span>
          <span className="stats-card-label">{label}</span>
          {subLabel && <span className="stats-card-sublabel">{subLabel}</span>}
        </div>
      </div>
    </div>
  );
}
