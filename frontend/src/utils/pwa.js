/* ─── PWA registration ─────────────────────────────────────
   Registers the offline shell in production only — a service
   worker in front of the Vite dev server serves stale modules
   and makes hot reload look broken.
   ───────────────────────────────────────────────────────── */

let deferredPrompt = null;
const installListeners = new Set();

/** Tell every subscriber whether an install prompt is available now. */
function notify() {
  for (const listener of installListeners) {
    try {
      listener(!!deferredPrompt);
    } catch {
      /* one bad subscriber must not break the rest */
    }
  }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        /* When a new build is waiting, hand over on the next navigation
           rather than mid-session — swapping chunks under a running app
           is how you get a blank screen. */
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch(() => {
        /* Offline support is a bonus; failing to register is not an error
           the user needs to hear about. */
      });
  });
}

/* Chrome fires this instead of showing its own install banner. Holding
   the event lets the app offer "Install" at a moment that makes sense. */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function canInstall() {
  return !!deferredPrompt;
}

/** Subscribe to install-availability changes. Returns an unsubscribe fn. */
export function onInstallAvailable(listener) {
  installListeners.add(listener);
  listener(!!deferredPrompt);
  return () => installListeners.delete(listener);
}

/** Show the native install prompt. Resolves true if the user accepted. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const prompt = deferredPrompt;
  // The event is single-use — clear it before awaiting the choice.
  deferredPrompt = null;
  notify();
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  return outcome === 'accepted';
}

/** True when the app is running from the home screen rather than a tab. */
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}
