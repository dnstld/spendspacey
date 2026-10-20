import { Generations, type GenerationHost, type WorkerInventory } from '../worker/generations';
import { digest, META, canonical, type RecordBody, type Stored } from '../worker/schema';
import { mimeFor } from '../worker/policy';
export const origin = 'https://app.example.test';
export class StaticFixture {
  stores = new Map<string, Map<string, Response>>();
  windows: { id: string; url: string; visibilityState?: string }[] = [];
  busy = false;
  online = true;
  failPath = '';
  delayPath = '';
  fetches: Request[] = [];
  failKind = '';
  deadline = 500;
  releaseDelay?: () => void;
  transform?: (request: Request, response: Response) => Response;
  private locked = new Set<string>();
  private queues = new Map<string, Promise<void>>();
  caches = {
    has: async (name: string) => this.stores.has(name),
    delete: async (name: string) => this.stores.delete(name),
    keys: async () => [...this.stores.keys()],
    open: async (name: string) => {
      let rows = this.stores.get(name);
      if (!rows) {
        rows = new Map();
        this.stores.set(name, rows);
      }
      const data = rows;
      return {
        keys: async () => [...data.keys()].map((url) => new Request(url)),
        match: async (input: RequestInfo | URL) =>
          data
            .get(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
            ?.clone(),
        put: async (input: RequestInfo | URL, response: Response) => {
          if (
            name === META &&
            this.failKind &&
            (JSON.parse(await response.clone().text()).body as RecordBody).kind === this.failKind
          )
            throw new Error('Interrupted persistence');
          data.set(
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
            response.clone(),
          );
        },
        delete: async (input: RequestInfo | URL) =>
          data.delete(
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
          ),
      } as unknown as Cache;
    },
  } as CacheStorage;
  locks = {
    request: (
      _name: string,
      options: LockOptions,
      callback: (lock: Lock | null) => Promise<unknown>,
    ) => {
      if (options.ifAvailable && this.locked.has(_name)) return callback(null);
      const result = (this.queues.get(_name) ?? Promise.resolve()).then(async () => {
        this.locked.add(_name);
        try {
          return await callback({ name: _name, mode: options.mode ?? 'exclusive' } as Lock);
        } finally {
          this.locked.delete(_name);
        }
      });
      this.queues.set(
        _name,
        result.then(
          () => {},
          () => {},
        ),
      );
      return result;
    },
  } as LockManager;
  bodies = new Map<string, { body: string; type: string }>();
  host(): GenerationHost {
    return {
      origin,
      caches: this.caches,
      locks: this.locks,
      windows: async () => this.windows,
      busy: () => this.busy,
      online: () => this.online,
      repairDeadline: this.deadline,
      fetch: async (request) => {
        this.fetches.push(request);
        const path = new URL(request.url).pathname;
        if (path === this.delayPath)
          await new Promise<void>((resolve, reject) => {
            this.releaseDelay = resolve;
            request.signal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            );
          });
        if (!this.online || path === this.failPath) throw new Error('Network unavailable');
        const value = this.bodies.get(path);
        if (!value)
          return new Response('<html>fallback</html>', {
            headers: { 'content-type': 'text/html' },
          });
        const response = new Response(value.body, { headers: { 'content-type': value.type } });
        return this.transform?.(request, response) ?? response;
      },
    };
  }
  async engine(version: string, compatibility?: string) {
    compatibility ??= await digest('policy-v2');
    const urls = [
      '/',
      '/manifest.webmanifest',
      '/google-g.png',
      '/fonts/google-sans-medium.woff2',
      '/icons/app-192.png',
      '/icons/app-512.png',
      '/icons/maskable-512.png',
      '/icons/apple-touch-icon.png',
      `/assets/index-${version.padEnd(8, 'x')}.js`,
      '/assets/supabase-sharedxx.js',
      '/assets/index-sharedxx.css',
    ].sort();
    const implementation = await digest('worker-' + version);
    const inventory: WorkerInventory[] = [];
    for (const url of urls) {
      const body =
        url === '/' || (url.includes('index-') && url.endsWith('.js'))
          ? version + ':' + url
          : 'shared:' + url;
      const hash = await digest(body);
      const integrity =
        'sha256-' +
        btoa(String.fromCharCode(...hash.match(/../g)!.map((value) => parseInt(value, 16))));
      const type = mimeFor(url);
      inventory.push({
        url,
        key: url,
        revision: url.startsWith('/assets/') ? null : 'a'.repeat(32),
        integrity,
        type,
        bytes: new TextEncoder().encode(body).length,
        worker: '',
        implementation,
        compatibility,
      });
      this.bodies.set(url, { body, type });
    }
    const entries = inventory.map(({ url, key, revision, integrity, type, bytes }) => ({
      url,
      key,
      revision,
      integrity,
      type,
      bytes,
    }));
    const worker = await digest(canonical({ entries, compatibility, implementation }));
    return new Generations(
      this.host(),
      inventory.map((entry) => ({ ...entry, worker })),
    );
  }
  async records(): Promise<Stored[]> {
    return Promise.all(
      [...(this.stores.get(META)?.values() ?? [])].map(
        async (response) => JSON.parse(await response.clone().text()) as Stored,
      ),
    );
  }
  async completion(engine: Generations) {
    const snapshot = await engine.snapshot();
    if (!snapshot.head) throw new Error('No selection');
    const body = snapshot.head.body;
    if (body.kind !== 'select' || !body.selected) throw new Error('No selected generation');
    return { snapshot, ref: body.selected, body };
  }
  async damage(engine: Generations, kind: 'missing' | 'bytes' = 'missing', own = false) {
    const snapshot = await engine.snapshot();
    const completions = [...snapshot.records].filter(
      ([, r]) => r.kind === 'complete' && r.descriptor.generation === engine.descriptor.generation,
    );
    const [, completion] = own
      ? completions.at(-1)!
      : [
          (await this.completion(engine)).ref,
          snapshot.records.get((await this.completion(engine)).ref)!,
        ];
    if (completion.kind !== 'complete') throw new Error('No completion');
    const reservation = snapshot.records.get(completion.reservation);
    if (reservation?.kind !== 'reserve') throw new Error('No reservation');
    const name = 'spendspacey-static-resource-v2-' + reservation.instance;
    const key =
      origin +
      completion.descriptor.entries.find((e) => /^\/assets\/index-.*\.js$/.test(e.url))!.key;
    const rows = this.stores.get(name)!;
    if (kind === 'missing') rows.delete(key);
    else
      rows.set(
        key,
        new Response('corrupt', { headers: { 'content-type': 'application/javascript' } }),
      );
  }
  async mutate(record: Stored, body: unknown) {
    const rows = this.stores.get(META)!;
    rows.delete(origin + '/__spendspacey_static_v2__/' + record.id);
    const id = await digest(canonical(body));
    rows.set(
      origin + '/__spendspacey_static_v2__/' + id,
      new Response(canonical({ id, body }), { headers: { 'content-type': 'application/json' } }),
    );
  }
}
export function navigation(path = '/') {
  const request = new Request(origin + path);
  Object.defineProperty(request, 'mode', { value: 'navigate' });
  return request;
}
