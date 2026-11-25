import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

type Result<T> = { key: string; revision: number } & (
  { status: 'ready'; data: T } | { status: 'error'; data?: never }
);

export function useResource<T>(
  key: string | null,
  online: boolean,
  read: (signal: AbortSignal) => Promise<T>,
) {
  const [result, setResult] = useState<Result<T>>();
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!key || !online) return;
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => read(controller.signal))
      .then(
        (data) => {
          if (!controller.signal.aborted) setResult({ key, revision, status: 'ready', data });
        },
        () => {
          if (!controller.signal.aborted) setResult({ key, revision, status: 'error' });
        },
      );
    return () => controller.abort();
  }, [key, online, read, revision]);

  const current = result?.key === key ? result : undefined;
  return {
    data: current?.data,
    error: online && current?.revision === revision && current?.status === 'error',
    retry,
  };
}

function subscribe(listener: () => void) {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine !== false);
}
