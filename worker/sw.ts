import { Generations, type WorkerInventory } from './generations';
import { routeRequest } from './policy';
import { isBrowserActive } from './authority';

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
    active: () => isBrowserActive(self),
  },
  self.__WB_MANIFEST,
);
const startup = engine.initialize();
self.addEventListener('install', (event) => event.waitUntil(startup.then(() => engine.install())));
self.addEventListener('activate', (event) => {
  const activation = startup.then(() => engine.activate());
  event.waitUntil(activation);
  event.waitUntil(activation.then(() => engine.cleanup()).catch(() => false));
});
// No claim, skipWaiting, automatic reload, optional navigation hints or runtime cache.
self.addEventListener('fetch', (event) => {
  if (routeRequest(event.request, self.location.origin, new Set([event.request.url])) === 'network')
    return;
  let reconciled = false;
  const response = startup.then(async () => {
    reconciled = await engine.reconcile();
    if (!reconciled) {
      // No delivery/binding mutation is attempted without activation authority.
      // A failed activation never authorizes bytes or a new document binding.
      return engine.unavailableResponse(event.request);
    }
    return (
      (await engine.respond(event.request, event.resultingClientId, event.clientId)) ??
      Response.error()
    );
  });
  event.respondWith(response);
  if (event.resultingClientId)
    event.waitUntil(
      response.then(() => (reconciled ? engine.cleanup() : false)).catch(() => false),
    );
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
    startup.then(async () => {
      const reconciled = await engine.reconcile();
      if (!reconciled && event.data?.operation !== 'HELLO') return;
      let status = await engine.message(
        event.data,
        { id: source.id, url: source.url },
        event.origin,
      );
      if (status && !reconciled)
        status = {
          ...status,
          authority: 'none',
          binding: null,
          generation: null,
          ready: false,
          repair: 'unavailable',
        };
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
