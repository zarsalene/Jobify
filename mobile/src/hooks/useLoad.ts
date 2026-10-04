import { useCallback, useEffect, useRef, useState } from 'react';

export interface LoadState<T> {
  data: T | undefined;
  error: Error | undefined;
  /** True only for the first load (no data yet). */
  loading: boolean;
  reload: () => Promise<void>;
  setData: (d: T) => void;
}

/**
 * Minimal async loader. `initial` (e.g. from the offline cache) is shown
 * immediately while the fetch runs, and kept if the fetch fails.
 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = [], initial?: T): LoadState<T> {
  const [data, setData] = useState<T | undefined>(initial);
  const [error, setError] = useState<Error | undefined>();
  const [loading, setLoading] = useState(initial === undefined);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    setError(undefined);
    try {
      const d = await fnRef.current();
      if (mine === seq.current) setData(d);
    } catch (e) {
      if (mine === seq.current) setError(e as Error);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      seq.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}
