import { isCallbackPath } from '@/lib/callbackRoute';
type PwaState = {
  readiness: 'preparing' | 'prepared' | 'ready' | 'unavailable';
  waiting: boolean;
  recovery: boolean;
  repairing: boolean;
  repaired: boolean;
};
type Status = { ready?: boolean; prepared?: boolean; pending?: boolean; repair?: string };
let state: PwaState = {
  readiness: 'preparing',
  waiting: false,
  recovery: false,
  repairing: false,
  repaired: false,
};
const listeners = new Set<() => void>();
let started = false;
let registration: ServiceWorkerRegistration | undefined;
let checking: Promise<void> | undefined;
let lastCheck = 0;
const repairKey = 'spendspacey.static-repair-attempt';
export const pwaSnapshot = () => state;
export function subscribePwa(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function publish(update: Partial<PwaState>) {
  state = { ...state, ...update };
  listeners.forEach((listener) => listener());
}
function ask(
  worker: ServiceWorker,
  type: string,
  details: Record<string, unknown> = {},
): Promise<Status> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => {
      channel.port1.close();
      resolve({ ready: false });
    }, 15000);
    channel.port1.onmessage = (event: MessageEvent<Status>) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data);
    };
    try {
      worker.postMessage({ type, ...details }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      channel.port1.close();
      resolve({ ready: false });
    }
  });
}
async function readiness() {
  const controller = navigator.serviceWorker.controller;
  const worker = controller ?? registration?.active;
  const result = worker ? await ask(worker, 'STATUS') : {};
  publish({
    readiness: result.ready
      ? controller
        ? 'ready'
        : 'prepared'
      : result.prepared
        ? 'prepared'
        : registration?.installing
          ? 'preparing'
          : 'unavailable',
    recovery: state.recovery || !!result.pending || (!!controller && result.ready === false),
  });
  if (registration?.waiting) {
    const waiting = await ask(registration.waiting, 'STATUS');
    publish({ waiting: waiting.prepared === true });
  }
}
export function checkForUpdate() {
  if (!registration || navigator.onLine === false || document.visibilityState === 'hidden') return;
  if (checking) return checking;
  if (Date.now() - lastCheck < 30000) return;
  lastCheck = Date.now();
  checking = registration
    .update()
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      checking = undefined;
    });
  return checking;
}
export function startPwa(production = import.meta.env.PROD) {
  if (started) return;
  started = true;
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    publish({ recovery: true, readiness: 'unavailable' });
  });
  if (!production || !navigator.serviceWorker || !window.caches) {
    publish({ readiness: 'unavailable' });
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    void readiness();
  });
  window.addEventListener('online', () => {
    void checkForUpdate();
    void readiness();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void checkForUpdate();
      void readiness();
    }
  });
  void navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then((value) => {
      registration = value;
      const watched = new WeakSet<ServiceWorker>();
      function watch(worker: ServiceWorker | null) {
        if (!worker || watched.has(worker)) return;
        watched.add(worker);
        worker.addEventListener('statechange', () => {
          void readiness();
        });
      }
      value.addEventListener('updatefound', () => watch(value.installing));
      watch(value.installing);
      void navigator.serviceWorker.ready.then(() => readiness());
      void readiness();
      void checkForUpdate();
    })
    .catch(() => publish({ readiness: 'unavailable' }));
}
export async function repairStaticShell(blocked = false) {
  if (blocked || state.repairing || navigator.onLine === false || isCallbackPath(location.pathname))
    return;
  const worker = navigator.serviceWorker?.controller;
  if (!worker) return;
  let request: string;
  try {
    request = crypto.randomUUID();
    sessionStorage.setItem(repairKey, request);
  } catch {
    return;
  }
  publish({ repairing: true });
  // A new ID exists only after an explicit click. Neither startup nor reconnect
  // replays it; the worker persists the boundary before touching the network.
  const result = await ask(worker, 'REPAIR', { request, blocked: false });
  publish({ repairing: false, repaired: result.repair === 'complete' });
  await readiness();
}
