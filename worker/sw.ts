import { PrecacheController } from 'workbox-precaching';
import {
  CACHE_POLICY,
  CACHE_PREFIX,
  routeRequest,
  staticPath,
  validStaticResponse,
} from './policy';

declare const self: ServiceWorkerGlobalScope;

const precache = new PrecacheController({
  cacheName: `${CACHE_PREFIX}${CACHE_POLICY}`,
  plugins: [
    {
      requestWillFetch: async ({ request }) =>
        new Request(request, { credentials: 'omit', redirect: 'error' }),
      cacheWillUpdate: async ({ request, response }) =>
        validStaticResponse(new URL(request.url).pathname, response) ? response : null,
    },
  ],
});
const entries = self.__WB_MANIFEST as { url: string; revision: string | null; integrity: string }[];
if (entries.some(({ url }) => !staticPath(new URL(url, self.location.origin).pathname)))
  throw new Error('Unreviewed static asset');
precache.addToCacheList(entries);
const approved = new Set(precache.getURLsToCacheKeys().keys());

async function validBytes(url: string, response: Response) {
  if (!validStaticResponse(new URL(url).pathname, response)) return false;
  const entry = entries.find((entry) => new URL(entry.url, self.location.origin).href === url);
  const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
  const hash = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return entry?.integrity === `sha256-${hash}`;
}
async function complete() {
  const cache = await caches.open(precache.strategy.cacheName);
  for (const [url, key] of precache.getURLsToCacheKeys()) {
    const response = await cache.match(key);
    if (!response || !(await validBytes(url, response))) return false;
  }
  return true;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precache.install(event).then(async () => {
      if (!(await complete())) throw new Error('Incomplete static shell');
    }),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await precache.activate(event);
      // Only after complete activation; never delete unrelated caches/storage.
      for (const name of await caches.keys()) {
        if (name.startsWith(CACHE_PREFIX) && name !== precache.strategy.cacheName)
          await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const kind = routeRequest(event.request, self.location.origin, approved);
  // No respondWith means native network handling, with no runtime cache.
  if (kind === 'network') return;
  event.respondWith(
    (async () => {
      const response = await precache.matchPrecache(
        kind === 'static' ? event.request.url : '/index.html',
      );
      const url =
        kind === 'static' ? event.request.url : new URL('/index.html', self.location.origin).href;
      if (!response || !(await validBytes(url, response))) return Response.error();
      if (kind !== 'callback') return response;
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('Referrer-Policy', 'no-referrer');
      return new Response(response.body, { status: 200, headers });
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (!event.ports[0] || !['STATUS', 'REPAIR'].includes(event.data?.type)) return;
  event.waitUntil(
    (async () => {
      try {
        // Explicit online repair only fills this worker's missing entries. No
        // skipWaiting, unregister, blanket deletion, or Auth/locale storage access.
        if (event.data.type === 'REPAIR') {
          const cache = await caches.open(precache.strategy.cacheName);
          const replacements: [string, Response][] = [];
          for (const [url, key] of precache.getURLsToCacheKeys()) {
            const existing = await cache.match(key);
            if (existing && (await validBytes(url, existing))) continue;
            const entry = entries.find(
              (entry) => new URL(entry.url, self.location.origin).href === url,
            )!;
            const response = await fetch(url, {
              credentials: 'omit',
              redirect: 'error',
              cache: 'reload',
              integrity: entry.integrity,
            });
            if (!(await validBytes(url, response))) throw new Error('Invalid replacement');
            replacements.push([key, response]);
          }
          for (const [key, response] of replacements) await cache.put(key, response);
        }
        event.ports[0].postMessage({ ready: await complete() });
      } catch {
        event.ports[0].postMessage({ ready: false });
      }
    })(),
  );
});
