import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import { registerServiceWorker } from './utils/pwa';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Auth wraps Theme, not the other way round: the theme engine
          reads the signed-in plan to decide which palettes are unlocked
          and pushes changes back to the account. */}
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Offline shell + install prompt. No-ops in development.
registerServiceWorker();
