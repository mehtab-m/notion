import React, { useState, useEffect, useCallback } from 'react';
import { FolderKanban, BookOpen, Tv, Table } from 'lucide-react';
import { getProjects, getBooks, getShows, getTables, getDashboardStats, getApiBase } from '../utils/api';
import StatsCard from '../components/Dashboard/StatsCard';
import ProgressRing from '../components/Dashboard/ProgressRing';
import RecentActivity from '../components/Dashboard/RecentActivity';
import QuickAdd from '../components/Dashboard/QuickAdd';
import DashboardCharts from '../components/Dashboard/DashboardCharts';
import useMediaQuery, { MOBILE_QUERY } from '../hooks/useMediaQuery';
import { useAuth } from '../context/AuthContext';
import { resolvePosterUrl } from '../components/Shows/ShowCard';
import './Dashboard.css';

const BACKEND = getApiBase();

function priorityColor(priority) {
  if (priority === 'high') return 'var(--accent-red)';
  if (priority === 'medium') return 'var(--accent-yellow)';
  return 'var(--accent-green)';
}

export default function Dashboard() {
  const [data, setData] = useState({ projects: [], books: [], shows: [], tables: [] });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { isDeveloper } = useAuth();
  const showProjects = isDeveloper && !isMobile;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      if (isDeveloper) {
        const [projects, books, shows, tables, dashStats] = await Promise.all([
          getProjects(),
          getBooks(),
          getShows(),
          getTables(),
          getDashboardStats(),
        ]);
        setData({ projects, books, shows, tables });
        setStats(dashStats);
      } else {
        const [books, shows, tables, dashStats] = await Promise.all([
          getBooks(),
          getShows(),
          getTables(),
          getDashboardStats(),
        ]);
        setData({ projects: [], books, shows, tables });
        setStats(dashStats);
      }
    } catch (err) {
      console.error('Dashboard fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [isDeveloper]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const { projects, books, shows, tables } = data;

  const activeProjects = projects.filter((p) => p.status === 'active');
  const readingBooks = books.filter((b) => b.status === 'reading');
  const watchingShows = shows.filter((s) => s.status === 'watching');

  const recentActivity = [
    ...(showProjects ? projects.map((p) => ({ title: p.title, type: 'project', date: p.updatedAt || p.createdAt, action: `Project · ${p.status}` })) : []),
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
      <div className="dashboard-stats">
        {showProjects && (
          <StatsCard
            icon={FolderKanban}
            label="Projects"
            value={projects.length}
            subLabel={`${activeProjects.length} active`}
            color="var(--accent)"
          />
        )}
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

      <div className="dashboard-section">
        <QuickAdd onAdded={fetchAll} hideProjects={!showProjects} />
      </div>

      <DashboardCharts stats={stats} />

      <div className="dashboard-grid">
        <div className="dashboard-left">
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

          {watchingShows.length > 0 && (
            <div className="dashboard-section">
              <h2 className="section-title">Currently Watching</h2>
              <div className="in-progress-list">
                {watchingShows.map((show) => {
                  const posterSrc = resolvePosterUrl(show.posterImage);
                  return (
                    <div key={show._id} className="in-progress-item">
                      {posterSrc ? (
                        <img src={posterSrc} alt={show.title} className="in-progress-cover" />
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
                  );
                })}
              </div>
            </div>
          )}

          {showProjects && activeProjects.length > 0 && (
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
