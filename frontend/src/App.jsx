import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { StickyNotesOverlayProvider } from './context/StickyNotesOverlayContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import MobileNav from './components/MobileNav';
import ErrorBoundary from './components/ErrorBoundary';
import CommandPalette from './components/CommandPalette';
import QuickCapture from './components/QuickCapture';
import ShortcutsOverlay from './components/ShortcutsOverlay';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import { PageSkeleton } from './components/Skeleton';

/* Routes are split so the first paint downloads only the shell plus the
   page actually being visited. Previously every page — including the
   marketing site, the chart library and the animation library — shipped
   in one ~800 KB bundle before anything rendered. */
const LandingPage = lazy(() => import('./pages/landing/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TodayPage = lazy(() => import('./pages/TodayPage'));
const InboxPage = lazy(() => import('./pages/InboxPage'));
const FocusPage = lazy(() => import('./pages/FocusPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ArchivePage = lazy(() => import('./pages/ArchivePage'));
const UpgradePage = lazy(() => import('./pages/UpgradePage'));
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

/* Title plus the one-line explanation the navbar shows under it. */
const PAGE_META = {
  '/': ['Dashboard', 'Everything at a glance'],
  '/today': ['My Day', 'What is worth doing right now'],
  '/inbox': ['Inbox', 'Capture first, sort later'],
  '/focus': ['Focus', 'One block at a time'],
  '/analytics': ['Insights', 'What the numbers say'],
  '/archive': ['Archive', 'Shelved, deleted and starred'],
  '/upgrade': ['Plans', 'Common, Premium and Platinum'],
  '/projects': ['Projects', 'Work with a deadline'],
  '/money': ['Money', 'Who owes what'],
  '/books': ['Books', 'Your reading list'],
  '/shows': ['Shows', 'What you are watching'],
  '/tables': ['Tables', 'Structured data'],
  '/notes': ['Notebook', 'Long-form thinking'],
  '/stickynotes': ['Sticky Notes', 'Quick reminders on screen'],
  '/habits': ['Habit Tracker', 'The part you do not decide'],
  '/goals': ['Goal Constellation', 'Where you are heading'],
  '/admin': ['Product Admin', 'Accounts and usage'],
  '/settings': ['Settings', 'Your account and appearance'],
};

function getMeta(pathname) {
  if (pathname.startsWith('/tables/')) return ['Table View', 'Structured data'];
  if (pathname.startsWith('/projects/')) return ['Project', 'Tasks, files and the team'];
  return PAGE_META[pathname] || ['Dashboard', ''];
}

const TOAST_STYLE = {
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-md)',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
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

/**
 * Sends every navigation back to the top. The shell scrolls the document,
 * so without this a route change from halfway down a long list dropped you
 * halfway down the next page.
 */
function useScrollToTop(pathname) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
}

/** Keeps the browser tab title in step with the current page. */
function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · SortLife` : 'SortLife';
  }, [title]);
}

function AppShell() {
  const location = useLocation();
  const [title, subtitle] = getMeta(location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { needsDeveloperChoice } = useAuth();
  const { toggleTheme, themes, themeId, setTheme, canUse } = useTheme();

  useDocumentTitle(title);
  useScrollToTop(location.pathname);

  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const openSearch = useCallback(() => setPaletteOpen((open) => !open), []);
  const openCapture = useCallback(() => setCaptureOpen(true), []);
  const openShortcuts = useCallback(() => setShortcutsOpen((open) => !open), []);

  /** Cycle to the next theme this account is allowed to use. */
  const nextTheme = useCallback(() => {
    const allowed = themes.filter((t) => canUse(t.id));
    if (allowed.length < 2) return;
    const index = allowed.findIndex((t) => t.id === themeId);
    setTheme(allowed[(index + 1) % allowed.length].id);
  }, [themes, themeId, canUse, setTheme]);

  useKeyboardShortcuts({
    onSearch: openSearch,
    onQuickCapture: openCapture,
    onShortcuts: openShortcuts,
    onToggleTheme: toggleTheme,
    onNextTheme: nextTheme,
  });

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <StickyNotesOverlayProvider>
      <div className="app-layout">
        <a href="#main-content" className="skip-link">Skip to content</a>

        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onQuickCapture={openCapture}
        />
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}

        <div className="app-main">
          <Navbar
            title={title}
            subtitle={subtitle}
            onMenuClick={() => setSidebarOpen(true)}
            onSearchClick={() => setPaletteOpen(true)}
            onShortcuts={openShortcuts}
          />
          <main className="app-content" id="main-content" tabIndex={-1}>
            {/* Keyed on pathname so navigating away clears a crashed page. */}
            <ErrorBoundary resetKey={location.pathname}>
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/today" element={<TodayPage />} />
                  <Route path="/inbox" element={<InboxPage />} />
                  <Route path="/focus" element={<FocusPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/archive" element={<ArchivePage />} />
                  <Route path="/upgrade" element={<UpgradePage />} />
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

        <MobileNav onQuickCapture={openCapture} onMenu={() => setSidebarOpen(true)} />

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
        <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} />
        <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

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
