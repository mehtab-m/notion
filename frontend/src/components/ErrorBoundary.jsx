import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import './ErrorBoundary.css';

/**
 * Without this, any render-time throw unmounts the whole tree and the
 * user is left staring at a blank white page with no way back.
 *
 * `resetKey` lets the shell clear the error on navigation, so a broken
 * page does not trap the rest of the app.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // A chunk that 404s usually means a new deploy replaced the file
    // this tab was holding a reference to — a reload genuinely fixes it.
    const isStaleChunk =
      /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(
        error.message || ''
      );

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-icon">
          <AlertTriangle size={28} />
        </div>
        <h2>{isStaleChunk ? 'A new version is available' : 'Something went wrong'}</h2>
        <p>
          {isStaleChunk
            ? 'This page was updated while you had it open. Reload to get the latest version.'
            : 'This page hit an unexpected error. Your saved work is safe.'}
        </p>

        {!isStaleChunk && import.meta.env.DEV && (
          <pre className="error-boundary-detail">{error.message}</pre>
        )}

        <div className="error-boundary-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            <RotateCcw size={15} />
            Reload
          </button>
          {!isStaleChunk && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                this.setState({ error: null });
                window.location.assign('/');
              }}
            >
              <Home size={15} />
              Back to dashboard
            </button>
          )}
        </div>
      </div>
    );
  }
}
