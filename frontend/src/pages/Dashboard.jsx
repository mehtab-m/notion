import React, { useState, useEffect, useCallback } from 'react';
import { FolderKanban, BookOpen, Tv, Table } from 'lucide-react';
import { getProjects, getBooks, getShows, getTables } from '../utils/api';
import StatsCard from '../components/Dashboard/StatsCard';
import ProgressRing from '../components/Dashboard/ProgressRing';
import RecentActivity from '../components/Dashboard/RecentActivity';
import QuickAdd from '../components/Dashboard/QuickAdd';
import './Dashboard.css';

const BACKEND = 'http://localhost:5000';

function priorityColor(priority) {
  if (priority === 'high') return 'var(--accent-red)';
  if (priority === 'medium') return 'var(--accent-yellow)';
  return 'var(--accent-green)';
}

export default function Dashboard() {
  const [data, setData] = useState({ projects: [], books: [], shows: [], tables: [] });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [projects, books, shows, tables] = await Promise.all([
        getProjects(),
        getBooks(),
        getShows(),
        getTables(),
      ]);
      setData({ projects, books, shows, tables });
    } catch (err) {
      console.error('Dashboard fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const { projects, books, shows, tables } = data;

  const activeProjects = projects.filter((p) => p.status === 'active');
  const readingBooks = books.filter((b) => b.status === 'reading');
  const watchingShows = shows.filter((s) => s.status === 'watching');

  const recentActivity = [
    ...projects.map((p) => ({ title: p.title, type: 'project', date: p.updatedAt || p.createdAt, action: `Project · ${p.status}` })),
    ...books.map((b) => ({ title: b.title, type: 'book', date: b.createdAt, action: `Book · ${b.status}` })),
    ...shows.map((s) => ({ title: s.title, type: 'show', date: s.createdAt, action: `Show · ${s.status}` })),
    ...tables.map((t) => ({ title: t.name, type: 'table', date: t.createdAt, action: 'Table' })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 12);

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Stats Row */}
      <div className="dashboard-stats">
        <StatsCard
          icon={FolderKanban}
          label="Projects"
          value={projects.length}
          subLabel={`${activeProjects.length} active`}
          color="var(--accent)"
        />
        <StatsCard
          icon={BookOpen}
          label="Books"
          value={books.length}
          subLabel={`${readingBooks.length} reading`}
          color="var(--accent-green)"
        />
        <StatsCard
          icon={Tv}
          label="Shows"
          value={shows.length}
          subLabel={`${watchingShows.length} watching`}
          color="var(--accent-yellow)"
        />
        <StatsCard
          icon={Table}
          label="Tables"
          value={tables.length}
          subLabel="custom tables"
          color="var(--accent-blue)"
        />
      </div>

      {/* Quick Add */}
      <div className="dashboard-section">
        <QuickAdd onAdded={fetchAll} />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-left">
          {/* In Progress - Books */}
          {readingBooks.length > 0 && (
            <div className="dashboard-section">
              <h2 className="section-title">Currently Reading</h2>
              <div className="in-progress-list">
                {readingBooks.map((book) => {
                  const pct = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
                  return (
                    <div key={book._id} className="in-progress-item">
                      {book.coverImage ? (
                        <img src={`${BACKEND}${book.coverImage}`} alt={book.title} className="in-progress-cover" />
                      ) : (
                        <div className="in-progress-cover-placeholder">
                          <BookOpen size={20} color="var(--accent-green)" />
                        </div>
                      )}
                      <div className="in-progress-info">
                        <span className="in-progress-title">{book.title}</span>
                        <span className="in-progress-sub">{book.author}</span>
                        <div className="progress-bar" style={{ marginTop: 6 }}>
                          <div className="progress-bar-fill" style={{ width: `${pct}%`, background: 'var(--accent-green)' }} />
                        </div>
                        <span className="in-progress-pct">{pct}% · p.{book.currentPage}/{book.totalPages}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* In Progress - Shows */}
          {watchingShows.length > 0 && (
            <div className="dashboard-section">
              <h2 className="section-title">Currently Watching</h2>
              <div className="in-progress-list">
                {watchingShows.map((show) => (
                  <div key={show._id} className="in-progress-item">
                    {show.posterImage ? (
                      <img src={`${BACKEND}${show.posterImage}`} alt={show.title} className="in-progress-cover" />
                    ) : (
                      <div className="in-progress-cover-placeholder">
                        <Tv size={20} color="var(--accent-yellow)" />
                      </div>
                    )}
                    <div className="in-progress-info">
                      <span className="in-progress-title">{show.title}</span>
                      <span className="platform-badge platform-badge--small">{show.platform}</span>
                      <span className="in-progress-sub">S{show.currentSeason} E{show.currentEpisode}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects Overview */}
          {activeProjects.length > 0 && (
            <div className="dashboard-section">
              <h2 className="section-title">Active Projects</h2>
              <div className="projects-overview-list">
                {activeProjects.slice(0, 5).map((project) => (
                  <div key={project._id} className="projects-overview-item">
                    <ProgressRing
                      percent={project.progress}
                      size={52}
                      color={priorityColor(project.priority)}
                    />
                    <div className="projects-overview-info">
                      <span className="projects-overview-title">{project.title}</span>
                      <div className="projects-overview-meta">
                        <span
                          className="projects-priority-dot"
                          style={{ background: priorityColor(project.priority) }}
                        />
                        <span className="in-progress-sub">{project.priority} priority</span>
                        {project.dueDate && (
                          <span className="in-progress-sub">
                            Due {new Date(project.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="dashboard-right">
          <div className="dashboard-section">
            <h2 className="section-title">Recent Activity</h2>
            <RecentActivity items={recentActivity} />
          </div>
        </div>
      </div>
    </div>
  );
}
