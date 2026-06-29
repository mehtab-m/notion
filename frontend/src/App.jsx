import React, { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import StickyNotesOverlay from './components/StickyNotes/StickyNotesOverlay';
import Dashboard from './pages/Dashboard';
import ProjectsPage from './pages/ProjectsPage';
import BooksPage from './pages/BooksPage';
import ShowsPage from './pages/ShowsPage';
import TablesPage from './pages/TablesPage';
import NotesPage from './pages/NotesPage';
import StickyNotesPage from './pages/StickyNotesPage';
import HabitsPage from './pages/HabitsPage';
import GoalsPage from './pages/GoalsPage';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/projects': 'Projects',
  '/books': 'Books',
  '/shows': 'Shows',
  '/tables': 'Tables',
  '/notes': 'Notebook',
  '/stickynotes': 'Sticky Notes',
  '/habits': 'Habit Tracker',
  '/goals': 'Goals',
};

function getTitle(pathname) {
  if (pathname.startsWith('/tables/')) return 'Table View';
  return PAGE_TITLES[pathname] || 'Dashboard';
}

export default function App() {
  const location = useLocation();
  const { theme } = useTheme();
  const title = getTitle(location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toastStyle =
    theme === 'dark'
      ? { background: '#1e1e1e', color: '#e8e8e8', border: '1px solid #2a2a2a' }
      : { background: '#ffffff', color: '#111111', border: '1px solid #e2e2e2' };

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <div className="app-main">
        <Navbar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="/shows" element={<ShowsPage />} />
            <Route path="/tables" element={<TablesPage />} />
            <Route path="/tables/:id" element={<TablesPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/stickynotes" element={<StickyNotesPage />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/goals" element={<GoalsPage />} />
          </Routes>
        </div>
      </div>
      <StickyNotesOverlay />
      <Toaster position="bottom-right" toastOptions={{ style: toastStyle }} />
    </div>
  );
}
