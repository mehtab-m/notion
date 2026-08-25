import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Fetches on mount and whenever the signed-in user changes.
 *
 * `fetchFn` must be a stable reference (a module-level API function, or
 * one wrapped in useCallback) — an inline arrow changes identity every
 * render and would re-fetch in a loop.
 */
export default function useApi(fetchFn) {
  const { user } = useAuth();
  const userId = user?._id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  /* Monotonic request id. Responses that are not from the newest
     request are dropped, so a slow early response can no longer
     overwrite the result of a later one. */
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetch = useCallback(
    async ({ silent = false } = {}) => {
      if (!userId) {
        // Nothing to fetch without a user — do not leave the caller
        // showing a loading state forever.
        setLoading(false);
        return undefined;
      }

      const id = ++requestId.current;
      const controller = new AbortController();

      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        // API helpers that accept options can honour the signal; the
        // rest simply ignore the extra argument.
        const result = await fetchFn({ signal: controller.signal });
        if (!mounted.current || id !== requestId.current) return undefined;
        setData(result);
        return result;
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return undefined;
        if (!mounted.current || id !== requestId.current) return undefined;
        setError(err.response?.data?.error || err.message || 'An error occurred');
        return undefined;
      } finally {
        if (mounted.current && id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetchFn, userId]
  );

  useEffect(() => {
    fetch();
    // Invalidate any in-flight request when the effect is torn down.
    return () => {
      requestId.current += 1;
    };
  }, [fetch]);

  const setDataDirect = useCallback((updater) => {
    setData((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  return { data, loading, refreshing, error, refetch: fetch, setData: setDataDirect };
}
