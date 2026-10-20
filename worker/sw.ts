import { Generations, type WorkerInventory } from './generations';
import { routeRequest, staticPath } from './policy';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: WorkerInventory[] };
const inventory = self.__WB_MANIFEST as WorkerInventory[];
const engine = new Generations(
  {
    origin: self.location.origin,
    caches,
    locks: self.navigator.locks,
    fetch: (request) => fetch(request),
    windows: async () => [
      ...(await self.clients.matchAll({ type: 'window', includeUncontrolled: true })),
    ],
    busy: () => !!self.registration.installing || !!self.registration.waiting,
    online: () => self.navigator.onLine !== false,
  },
  inventory,
);
const startup = engine.initialize();
let activation: Promise<void> = startup;
self.addEventListener('install', (event) => {
  event.waitUntil(startup.then(() => engine.install()));
});
self.addEventListener('activate', (event) => {
  activation = startup
    .then(() => engine.activate())
    .then(() => engine.cleanup())
    .then(() => undefined);
  event.waitUntil(activation);
});
// Deliberately no claim, skipWaiting, forced reload or runtime caching.
self.addEventListener('fetch', (event) => {
  // These standard navigation hints are absent from TS's older worker lib.
  // Unknown hints cannot prove a fresh launch, so conservatively defer promotion.
  const navigation = event as FetchEvent & { replacesClientId?: string; isReload?: boolean };
  const replaces =
    navigation.isReload === true
      ? 'reload'
      : typeof navigation.replacesClientId === 'string'
        ? navigation.replacesClientId
        : typeof navigation.isReload === 'boolean'
          ? ''
          : 'unknown';
  const url = new URL(event.request.url);
  const kind = routeRequest(event.request, self.location.origin, new Set([event.request.url]));
  if (kind === 'network' || (!staticPath(url.pathname) && kind !== 'callback')) return;
  event.respondWith(
    activation.then(
      async () =>
        (await engine.respond(event.request, event.resultingClientId, replaces)) ||
        fetch(event.request),
    ),
  );
});
self.addEventListener('message', (event) => {
  const port = event.ports[0];
  if (!port || !['STATUS', 'REPAIR', 'CANCEL', 'CLEANUP'].includes(event.data?.type)) return;
  if (event.data.type === 'CANCEL') {
    engine.cancel(String(event.data.request));
    port.postMessage({ cancelled: true });
    return;
  }
  event.waitUntil(
    activation.then(async () => {
      try {
        if (event.data.type === 'REPAIR') {
          const source = event.source as Client | null;
          const blocked =
            event.data.blocked !== false || !source || new URL(source.url).pathname !== '/';
          port.postMessage(await engine.repair(String(event.data.request), blocked));
        } else if (event.data.type === 'CLEANUP')
          port.postMessage({ cleaned: await engine.cleanup() });
        else port.postMessage(await engine.status());
      } catch {
        port.postMessage({ ready: false, repair: 'failed' });
      }
    }),
  );
});
