import { isCallbackPath } from '@/lib/callbackRoute';

type PwaState = {
  readiness: 'preparing' | 'ready' | 'unavailable';
  waiting: boolean;
  recovery: boolean;
  repairing: boolean;
};
let state: PwaState = { readiness: 'preparing', waiting: false, recovery: false, repairing: false };
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
function ask(worker: ServiceWorker, type: 'STATUS' | 'REPAIR'): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => {
      channel.port1.close();
      resolve(false);
    }, 15_000);
    channel.port1.onmessage = (event: MessageEvent<{ ready?: boolean }>) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data.ready === true);
    };
    try {
      worker.postMessage({ type }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      channel.port1.close();
      resolve(false);
    }
  });
}
async function readiness() {
  const controller = navigator.serviceWorker.controller;
  const ready = controller && (await ask(controller, 'STATUS'));
  publish({ readiness: ready ? 'ready' : 'unavailable' });
  // Keep the one-reload guard across a failed reload. Clear only when the whole
  // shell and bootstrap have recovered, so persistent preload failures cannot loop.
  if (ready && !state.recovery) {
    try {
      sessionStorage.removeItem(repairKey);
    } catch {
      /* Optional storage. */
    }
  }
}
export function checkForUpdate() {
  if (!registration || navigator.onLine === false || document.visibilityState === 'hidden') return;
  if (checking) return checking;
  if (Date.now() - lastCheck < 30_000) return;
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
      function waiting() {
        publish({ waiting: !!value.waiting });
      }
      waiting();
      value.addEventListener('updatefound', () => {
        const worker = value.installing;
        worker?.addEventListener('statechange', () => {
          waiting();
          if (worker.state === 'activated') void readiness();
        });
      });
      void readiness();
      void checkForUpdate();
    })
    .catch(() => {
      publish({ readiness: 'unavailable' });
    });
}
export async function repairStaticShell() {
  if (state.repairing || navigator.onLine === false || isCallbackPath(location.pathname)) return;
  const worker = navigator.serviceWorker?.controller;
  if (!worker) return;
  try {
    if (sessionStorage.getItem(repairKey)) return;
    sessionStorage.setItem(repairKey, '1');
  } catch {
    return;
  } // Cannot guarantee the reload bound without storage.
  publish({ repairing: true });
  const ready = await ask(worker, 'REPAIR');
  publish({ repairing: false });
  if (ready) location.reload();
}
