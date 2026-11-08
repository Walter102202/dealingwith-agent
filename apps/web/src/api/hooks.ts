import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Runs `fetcher` on mount and whenever its identity changes (callers memoize
 * it with `useCallback` on their inputs); `refetch` re-runs it in place and
 * keeps the current data visible while loading. Results of a call superseded
 * by a newer one are dropped.
 */
export function useApi<T>(fetcher: () => Promise<T>): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);

  const run = useCallback(async () => {
    const mine = ++generation.current;
    setLoading(true);
    try {
      const result = await fetcher();
      if (mine !== generation.current) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (mine !== generation.current) return;
      setError(e);
    } finally {
      if (mine === generation.current) setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    void run();
  }, [run]);

  return { data, error, loading, refetch: run };
}
