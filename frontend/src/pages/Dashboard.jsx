import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { FolderKanban, BookOpen, Tv, Table, AlertTriangle, RotateCcw } from 'lucide-react';
import { getProjects, getBooks, getShows, getTables, getDashboardStats } from '../utils/api';
import StatsCard from '../components/Dashboard/StatsCard';
import ProgressRing from '../components/Dashboard/ProgressRing';
import QuickAdd from '../components/Dashboard/QuickAdd';
import { Skeleton, SkeletonRows } from '../components/Skeleton';
import useMediaQuery, { MOBILE_QUERY } from '../hooks/useMediaQuery';
import { useAuth } from '../context/AuthContext';
import { resolvePosterUrl } from '../components/Shows/ShowCard';
import { resolveCoverUrl } from '../components/Books/BookCard';
import './Dashboard.css';

/* Recharts plus its d3 dependencies are ~380 KB — larger than the rest
   of the app combined. Loading it lazily lets the stat cards and lists
   paint first, with the charts streaming in a moment later. */
const DashboardCharts = lazy(() => import('../components/Dashboard/DashboardCharts'));

function priorityColor(priority) {
  if (priority === 'high') return 'var(--accent-red)';
  if (priority === 'medium') return 'var(--accent-yellow)';
  return 'var(--accent-green)';
}

function ChartsFallback() {
  return (
    <div className="dashboard-charts-fallback" aria-hidden="true">
      <Skeleton height={240} radius="var(--radius)" />
      <Skeleton height={240} radius="var(--radius)" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard" role="status" aria-label="Loading dashboard">
      <div className="dashboard-stats">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={94} radius="var(--radius)" />
        ))}
      </div>
      <div className="dashboard-section">
        <Skeleton height={72} radius="var(--radius)" />
      </div>
      <ChartsFallback />
      <div className="dashboard-section">
        <SkeletonRows count={3} />
      </div>
      <span className="sr-only">Loading your dashboard…</span>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState({ projects: [], books: [], shows: [], tables: [] });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { isDeveloper } = useAuth();
  const showProjects = isDeveloper && !isMobile;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      // Previously this only logged, leaving an empty dashboard that
      // looked like a brand-new account rather than a failed load.
      console.error('Dashboard fetch error', err);
      setError(err.response?.data?.error || 'We could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, [isDeveloper]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const { projects, books, shows, tables } = data;

  const activeProjects = projects.filter((p) => p.status === 'active');
  const readingBooks = books.filter((b) => b.status === 'reading');
  const watchingShows = shows.filter((s) => s.status === 'watching');

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="empty-state" role="alert">
        <AlertTriangle size={34} />
        <h3>Could not load your dashboard</h3>
        <p>{error}</p>
        <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={fetchAll}>
          <RotateCcw size={15} />
          Try again
        </button>
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

      <Suspense fallback={<ChartsFallback />}>
        <DashboardCharts stats={stats} />
      </Suspense>

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
                      {resolveCoverUrl(book.coverImage) ? (
                        <img src={resolveCoverUrl(book.coverImage)} alt={book.title} className="in-progress-cover" />
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
      </div>
    </div>
  );
}
