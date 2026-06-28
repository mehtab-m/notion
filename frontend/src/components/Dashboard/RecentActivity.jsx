import React from 'react';
import { FolderKanban, BookOpen, Tv, Table } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import './RecentActivity.css';

const typeConfig = {
  project: { icon: FolderKanban, color: 'var(--accent)' },
  book: { icon: BookOpen, color: 'var(--accent-green)' },
  show: { icon: Tv, color: 'var(--accent-yellow)' },
  table: { icon: Table, color: 'var(--accent-blue)' },
};

export default function RecentActivity({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="recent-activity-empty">
        <p>No recent activity yet.</p>
      </div>
    );
  }

  return (
    <ul className="recent-activity-list">
      {items.map((item, idx) => {
        const config = typeConfig[item.type] || typeConfig.project;
        const Icon = config.icon;
        return (
          <li key={idx} className="recent-activity-item">
            <div className="recent-activity-icon" style={{ color: config.color }}>
              <Icon size={14} />
            </div>
            <div className="recent-activity-content">
              <span className="recent-activity-title">{item.title}</span>
              <span className="recent-activity-action">{item.action}</span>
            </div>
            <span className="recent-activity-time">
              {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
