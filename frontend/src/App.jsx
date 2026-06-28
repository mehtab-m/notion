import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import ProjectsPage from './pages/ProjectsPage';
import BooksPage from './pages/BooksPage';
import ShowsPage from './pages/ShowsPage';
import TablesPage from './pages/TablesPage';

function getTitle(pathname) {
  if (pathname === '/') return 'Dashboard';
  if (pathname === '/projects') return 'Projects';
  if (pathname === '/books') return 'Books';
  if (pathname === '/shows') return 'Shows';
  if (pathname.startsWith('/tables/')) return 'Table View';
  if (pathname === '/tables') return 'Tables';
  return 'Dashboard';
}

export default function App() {
  const location = useLocation();
  const { theme } = useTheme();
  const title = getTitle(location.pathname);

  const toastStyle =
    theme === 'dark'
      ? { background: '#1e1e1e', color: '#e8e8e8', border: '1px solid #2a2a2a' }
      : { background: '#ffffff', color: '#111111', border: '1px solid #e2e2e2' };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <Navbar title={title} />
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="/shows" element={<ShowsPage />} />
            <Route path="/tables" element={<TablesPage />} />
            <Route path="/tables/:id" element={<TablesPage />} />
          </Routes>
        </div>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{ style: toastStyle }}
      />
    </div>
  );
}
