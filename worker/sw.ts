import { Generations, type WorkerInventory } from './generations';
import { routeRequest } from './policy';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: WorkerInventory[] };
const engine = new Generations(
  {
    origin: self.location.origin,
    caches,
    locks: self.navigator.locks,
    fetch: (request) => fetch(request),
    windows: () => self.clients.matchAll({ type: 'window', includeUncontrolled: true }),
    busy: () => !!self.registration.installing || !!self.registration.waiting,
    online: () => self.navigator.onLine !== false,
  },
  self.__WB_MANIFEST,
);
const startup = engine.initialize();
let activation = startup;
self.addEventListener('install', (event) => event.waitUntil(startup.then(() => engine.install())));
self.addEventListener('activate', (event) => {
  activation = startup.then(() => engine.activate());
  event.waitUntil(activation);
  event.waitUntil(activation.then(() => engine.cleanup()).catch(() => false));
});
// No claim, skipWaiting, automatic reload, optional navigation hints or runtime cache.
self.addEventListener('fetch', (event) => {
  if (routeRequest(event.request, self.location.origin, new Set([event.request.url])) === 'network')
    return;
  const response = activation.then(
    async () =>
      (await engine.respond(event.request, event.resultingClientId, event.clientId)) ??
      Response.error(),
  );
  event.respondWith(response);
  if (event.resultingClientId)
    event.waitUntil(response.then(() => engine.cleanup()).catch(() => false));
  if (event.resultingClientId)
    event.waitUntil(
      event.handled.then(
        () => engine.evidence(event.resultingClientId, 'handled'),
        () => engine.evidence(event.resultingClientId, 'handling-error'),
      ),
    );
});
self.addEventListener('message', (event) => {
  const port = event.ports[0];
  if (!port) return;
  const source = event.source;
  // A ServiceWorker or MessagePort cannot masquerade as a browser window Client.
  if (
    !source ||
    !('id' in source) ||
    !('url' in source) ||
    !('type' in source) ||
    source.type !== 'window'
  )
    return;
  event.waitUntil(
    activation.then(async () => {
      const status = await engine.message(
        event.data,
        { id: source.id, url: source.url },
        event.origin,
      );
      if (status)
        port.postMessage({
          protocol: 3,
          operation: event.data.operation,
          request: event.data.request,
          status,
        });
    }),
  );
});
