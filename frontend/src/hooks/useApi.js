import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export default function useApi(fetchFn) {
  const { user } = useAuth();
  const userId = user?._id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async ({ silent = false } = {}) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'An error occurred');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fetchFn, userId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const setDataDirect = useCallback((updater) => {
    setData((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  return { data, loading, error, refetch: fetch, setData: setDataDirect };
}
