import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

type Result<T> = { key: string; revision: number } & (
  { status: 'ready'; data: T } | { status: 'error'; data?: never }
);

export function useResource<T>(
  key: string | null,
  online: boolean,
  read: (signal: AbortSignal) => Promise<T>,
  { fresh = false, timeout }: { fresh?: boolean; timeout?: number } = {},
) {
  const [result, setResult] = useState<Result<T>>();
  const [request, setRequest] = useState({ revision: 0, minimum: 0 });
  const { revision, minimum } = request;
  const retry = useCallback(
    () => setRequest(({ revision }) => ({ revision: revision + 1, minimum: revision + 1 })),
    [],
  );
  const poll = useCallback(
    () => setRequest(({ revision, minimum }) => ({ revision: revision + 1, minimum })),
    [],
  );
  useEffect(() => {
    if (!key || !online) return;
    const controller = new AbortController();
    const timer =
      timeout === undefined
        ? undefined
        : window.setTimeout(() => {
            controller.abort();
            setResult({ key, revision, status: 'error' });
          }, timeout);
    void Promise.resolve()
      .then(() => read(controller.signal))
      .then(
        (data) => {
          window.clearTimeout(timer);
          if (!controller.signal.aborted) setResult({ key, revision, status: 'ready', data });
        },
        () => {
          window.clearTimeout(timer);
          if (!controller.signal.aborted) setResult({ key, revision, status: 'error' });
        },
      );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, online, read, revision, timeout]);

  const current =
    result?.key === key && (!fresh || (online && result.revision >= minimum)) ? result : undefined;
  return {
    data: current?.data,
    error: online && current?.revision === revision && current?.status === 'error',
    retry,
    poll,
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
