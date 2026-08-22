import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../services/api';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
  setData: (data: T | null) => void;
}

export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    loaderRef
      .current(controller.signal)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError(0, 'UNEXPECTED_ERROR', (caught as Error).message),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [...deps, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { data, loading, error, reload, setData };
}

export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
