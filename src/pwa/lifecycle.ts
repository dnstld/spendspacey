import { isCallbackPath } from '@/lib/callbackRoute';
import type { StaticStatus } from '../../worker/generations';
type PwaState = {
  readiness: 'preparing' | 'prepared' | 'ready' | 'unavailable';
  waiting: boolean;
  recovery: boolean;
  repairing: boolean;
  repaired: boolean;
};
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
const confirmations = new Set<string>();
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
  operation: string,
  correlation?: StaticStatus,
): Promise<StaticStatus | undefined> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const request = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      channel.port1.close();
      resolve(undefined);
    }, 15000);
    channel.port1.onmessage = (event: MessageEvent) => {
      const reply = event.data;
      if (
        !reply ||
        reply.protocol !== 3 ||
        reply.operation !== operation ||
        reply.request !== request ||
        !reply.status ||
        typeof reply.status.ready !== 'boolean' ||
        typeof reply.status.worker !== 'string'
      )
        return;
      clearTimeout(timer);
      channel.port1.close();
      resolve(reply.status as StaticStatus);
    };
    try {
      worker.postMessage(
        {
          protocol: 3,
          operation,
          request,
          ...(correlation
            ? { worker: correlation.worker, epoch: correlation.epoch, binding: correlation.binding }
            : {}),
        },
        [channel.port2],
      );
    } catch {
      clearTimeout(timer);
      channel.port1.close();
      resolve(undefined);
    }
  });
}
async function readiness() {
  const controller = navigator.serviceWorker.controller;
  const worker = controller ?? registration?.active;
  const result: Partial<StaticStatus> = (worker ? await ask(worker, 'HELLO') : undefined) ?? {};
  if (
    worker &&
    controller &&
    'binding' in result &&
    result.binding &&
    !confirmations.has(result.binding)
  ) {
    confirmations.add(result.binding);
    void ask(worker, 'CONFIRM', result as StaticStatus);
  }
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
    repaired: result.repair === 'complete' && result.pending === true,
  });
  if (registration?.waiting) {
    const waiting = await ask(registration.waiting, 'HELLO');
    publish({ waiting: waiting?.prepared === true });
  } else publish({ waiting: false });
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
  if (blocked || state.repairing || isCallbackPath(location.pathname)) return;
  if (!navigator.serviceWorker?.controller) return;
  // Deliberate navigation opens the independent recovery surface. It cannot inherit
  // the application's Auth activity or execute a damaged/lazy application bundle.
  const worker = navigator.serviceWorker.controller;
  const status = await ask(worker, 'HELLO');
  if (
    status?.binding &&
    status.authority === 'application' &&
    (await ask(worker, 'RECOVERY', status))
  )
    location.assign('/');
}
