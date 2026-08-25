import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import { StickyNotesOverlayProvider } from './context/StickyNotesOverlayContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import CommandPalette from './components/CommandPalette';
import { PageSkeleton } from './components/Skeleton';

/* Routes are split so the first paint downloads only the shell plus the
   page actually being visited. Previously every page — including the
   marketing site, the chart library and the animation library — shipped
   in one ~800 KB bundle before anything rendered. */
const LandingPage = lazy(() => import('./pages/landing/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const MoneyPage = lazy(() => import('./pages/MoneyPage'));
const BooksPage = lazy(() => import('./pages/BooksPage'));
const ShowsPage = lazy(() => import('./pages/ShowsPage'));
const TablesPage = lazy(() => import('./pages/TablesPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
const StickyNotesPage = lazy(() => import('./pages/StickyNotesPage'));
const HabitsPage = lazy(() => import('./pages/HabitsPage'));
const GoalsPage = lazy(() => import('./pages/GoalsPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

/* Overlays are not needed for first paint either. */
const StickyNotesOverlay = lazy(() => import('./components/StickyNotes/StickyNotesOverlay'));
const MoneyWidget = lazy(() => import('./components/Money/MoneyWidget'));
const DeveloperOnboarding = lazy(() => import('./components/DeveloperOnboarding'));
const PremiumWelcome = lazy(() => import('./components/PremiumWelcome'));

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/projects': 'Projects',
  '/money': 'Money',
  '/books': 'Books',
  '/shows': 'Shows',
  '/tables': 'Tables',
  '/notes': 'Notebook',
  '/stickynotes': 'Sticky Notes',
  '/habits': 'Habit Tracker',
  '/goals': 'Goal Constellation',
  '/admin': 'Product Admin',
  '/settings': 'Settings',
};

function getTitle(pathname) {
  if (pathname.startsWith('/tables/')) return 'Table View';
  if (pathname.startsWith('/projects/')) return 'Project';
  return PAGE_TITLES[pathname] || 'Dashboard';
}

const TOAST_STYLE = {
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)',
};

const TOAST_OPTIONS = {
  style: TOAST_STYLE,
  duration: 3500,
  success: { iconTheme: { primary: 'var(--accent-green)', secondary: 'var(--bg-card)' } },
  error: { duration: 5000, iconTheme: { primary: 'var(--accent-red)', secondary: 'var(--bg-card)' } },
};

function DeveloperRoute({ children }) {
  const { isDeveloper } = useAuth();
  if (!isDeveloper) return <Navigate to="/" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

/** Keeps the browser tab title in step with the current page. */
function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · SortLife` : 'SortLife';
  }, [title]);
}

function AppShell() {
  const location = useLocation();
  const title = getTitle(location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { needsDeveloperChoice } = useAuth();

  useDocumentTitle(title);

  const closePalette = useCallback(() => setPaletteOpen(false), []);

  // Global search shortcut: Cmd+K / Ctrl+K, plus "/" when not typing.
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key?.toLowerCase();
      if (key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = e.target;
        const typing =
          el?.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName);
        if (!typing) {
          e.preventDefault();
          setPaletteOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <StickyNotesOverlayProvider>
      <div className="app-layout">
        <a href="#main-content" className="skip-link">Skip to content</a>

        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}

        <div className="app-main">
          <Navbar
            title={title}
            onMenuClick={() => setSidebarOpen(true)}
            onSearchClick={() => setPaletteOpen(true)}
          />
          <main className="app-content" id="main-content" tabIndex={-1}>
            {/* Keyed on pathname so navigating away clears a crashed page. */}
            <ErrorBoundary resetKey={location.pathname}>
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route
                    path="/projects"
                    element={(
                      <DeveloperRoute>
                        <ProjectsPage />
                      </DeveloperRoute>
                    )}
                  />
                  <Route
                    path="/projects/:id"
                    element={(
                      <DeveloperRoute>
                        <ProjectDetailPage />
                      </DeveloperRoute>
                    )}
                  />
                  <Route path="/money" element={<MoneyPage />} />
                  <Route path="/books" element={<BooksPage />} />
                  <Route path="/shows" element={<ShowsPage />} />
                  <Route path="/tables" element={<TablesPage />} />
                  <Route path="/tables/:id" element={<TablesPage />} />
                  <Route path="/notes" element={<NotesPage />} />
                  <Route path="/stickynotes" element={<StickyNotesPage />} />
                  <Route path="/habits" element={<HabitsPage />} />
                  <Route path="/goals" element={<GoalsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route
                    path="/admin"
                    element={(
                      <AdminRoute>
                        <AdminDashboard />
                      </AdminRoute>
                    )}
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>

        {/* Overlays must never take the app down with them. */}
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={null}>
            <StickyNotesOverlay />
            <MoneyWidget />
            {needsDeveloperChoice && <DeveloperOnboarding />}
            <PremiumWelcome />
          </Suspense>
        </ErrorBoundary>

        <CommandPalette open={paletteOpen} onClose={closePalette} />

        <Toaster position="bottom-right" toastOptions={TOAST_OPTIONS} />
      </div>
    </StickyNotesOverlayProvider>
  );
}

function PublicRoutes() {
  const location = useLocation();
  const redirectTo = location.pathname + location.search;

  return (
    <>
      <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<div className="spinner-container" style={{ minHeight: '100vh' }}><div className="spinner" /></div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/login"
              element={<AuthPage initialMode="login" redirectTo={redirectTo !== '/login' ? redirectTo : undefined} />}
            />
            <Route
              path="/signup"
              element={<AuthPage initialMode="signup" redirectTo={redirectTo !== '/signup' ? redirectTo : undefined} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <Toaster position="bottom-right" toastOptions={TOAST_OPTIONS} />
    </>
  );
}

export default function App() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="spinner-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
        <span className="sr-only">Loading SortLife…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PublicRoutes />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/signup" element={<Navigate to="/" replace />} />
      <Route path="/*" element={<AppShell key={user._id} />} />
    </Routes>
  );
}
