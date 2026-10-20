import { describe, expect, it } from 'vitest';
import { StaticFixture, navigation, origin } from '../../test/staticGenerations';
import { META, canonical, digest, metadataURL } from '../../worker/schema';

describe('durable static generation behavior', () => {
  it('fully prepares before control, uses canonical / and fetches only strict public inventory', async () => {
    const f = new StaticFixture();
    const e = await f.engine('v1');
    await e.install();
    expect((await e.status()).ready).toBe(false);
    await e.activate();
    expect((await e.status()).ready).toBe(true);
    f.online = false;
    expect(await (await e.respond(navigation()))!.text()).toBe('v1:/');
    expect(f.fetches.some((r) => r.url.endsWith('/index.html'))).toBe(false);
    for (const r of f.fetches) {
      expect(r.credentials).toBe('omit');
      expect(r.redirect).toBe('error');
      expect(r.integrity).toMatch(/^sha256-/);
    }
  });
  it.each(['missing', 'bytes'] as const)(
    'revalidates a damaged waiting replacement (%s), selecting the independently complete predecessor offline',
    async (kind) => {
      const f = new StaticFixture();
      const first = await f.engine('v1');
      await first.install();
      await first.activate();
      const old = await f.completion(first);
      const second = await f.engine('v2');
      await second.install();
      await f.damage(second, kind, true);
      f.online = false;
      await second.activate();
      expect((await second.status()).ready).toBe(true);
      expect(await (await second.respond(navigation()))!.text()).toBe('v1:/');
      expect(await second.verify(await second.snapshot(), old.ref)).toBe(true);
      const restart = await f.engine('v2');
      expect((await restart.status()).ready).toBe(true);
      expect(await (await restart.respond(navigation()))!.text()).toBe('v1:/');
    },
  );
  it('keeps both generations when neither is usable', async () => {
    const f = new StaticFixture();
    const a = await f.engine('v1');
    await a.install();
    await a.activate();
    await f.damage(a);
    const b = await f.engine('v2');
    await b.install();
    await f.damage(b, 'bytes', true);
    const names = [...f.stores.keys()];
    await b.activate();
    expect((await b.status()).ready).toBe(false);
    expect(await b.cleanup()).toBe(false);
    expect([...f.stores.keys()]).toEqual(names);
    expect((await b.respond(navigation()))!.type).toBe('error');
  });
  it.each(['complete', 'select'])(
    'recovers safely from interruption before persisted %s',
    async (kind) => {
      const f = new StaticFixture();
      const a = await f.engine('v1');
      await a.install();
      await a.activate();
      const b = await f.engine('v2');
      f.failKind = kind;
      if (kind === 'complete') await expect(b.install()).rejects.toThrow();
      else {
        await b.install();
        await b.activate();
      }
      f.failKind = '';
      const restart = await f.engine('v2');
      expect((await restart.status()).ready).toBe(false);
      expect(await (await a.respond(navigation()))!.text()).toBe('v1:/');
      expect(await restart.cleanup()).toBe(false);
    },
  );
  it('does not infer state from completed but never selected resources or legacy caches', async () => {
    const f = new StaticFixture();
    await f.caches.open('spendspacey-static-v1');
    const e = await f.engine('v1');
    await e.install();
    const restart = await f.engine('v1');
    expect((await restart.status()).ready).toBe(false);
    expect(await restart.cleanup()).toBe(false);
    expect(await f.caches.has('spendspacey-static-v1')).toBe(true);
  });
  it('supports complete v1 → v2 → v1 rollback with a compatible fallback', async () => {
    const f = new StaticFixture();
    for (const v of ['v1', 'v2', 'v1']) {
      const e = await f.engine(v);
      await e.install();
      await e.activate();
      expect(await (await e.respond(navigation()))!.text()).toBe(v + ':/');
      const selected = await f.completion(e);
      if (v === 'v1' && selected.body.sequence === 2) {
        expect(selected.body.fallback).not.toBeNull();
        expect(await e.verify(selected.snapshot, selected.body.fallback)).toBe(true);
      }
    }
    expect((await f.records()).filter((r) => r.body.kind === 'select')).toHaveLength(3);
  });
  it.each(['controlled', 'uncontrolled', 'hidden', 'unresponsive', 'newly-navigating'])(
    'defers cleanup for %s windows and retains a safe pair after three generations',
    async (state) => {
      const f = new StaticFixture();
      let last = await f.engine('v1');
      for (const v of ['v1', 'v2', 'v3']) {
        last = await f.engine(v);
        await last.install();
        await last.activate();
      }
      const old = [...(await last.snapshot()).chain][0].body;
      if (old.kind !== 'select') throw new Error();
      const count = f.stores.size;
      f.windows = [
        {
          id: state,
          url: state === 'newly-navigating' ? '' : origin + '/',
          visibilityState: state === 'hidden' ? 'hidden' : 'visible',
        },
      ];
      expect(await last.cleanup()).toBe(false);
      expect(f.stores.size).toBe(count);
      f.windows = [];
      expect(await last.cleanup()).toBe(true);
      expect(await last.verify(await last.snapshot(), old.selected)).toBe(false);
      const current = await f.completion(last);
      expect(await last.verify(current.snapshot, current.ref)).toBe(true);
      expect(await last.verify(current.snapshot, current.body.fallback)).toBe(true);
    },
  );
  it('protects another worker’s waiting/installation work and rejects stale-owner mutation', async () => {
    const f = new StaticFixture();
    const a = await f.engine('v1');
    await a.install();
    await a.activate();
    const b = await f.engine('v2');
    await b.install();
    await b.activate();
    const c = await f.engine('v3');
    f.busy = true;
    await c.install();
    expect(await b.cleanup()).toBe(false);
    await c.activate();
    f.busy = false;
    const before = (await f.records()).length;
    expect((await a.repair(crypto.randomUUID())).repair).toBe('failed');
    expect((await f.records()).length).toBe(before);
    expect(await a.cleanup()).toBe(false);
    expect((await a.respond(navigation()))!.type).toBe('error');
  });
  it('repairs into separate staging, preserves live windows, then promotes on the first fresh root after all close', async () => {
    const f = new StaticFixture();
    const a = await f.engine('v1');
    await a.install();
    await a.activate();
    const b = await f.engine('v2');
    await b.install();
    await f.damage(b, 'missing', true);
    await b.activate();
    f.windows = [{ id: 'open', url: origin + '/' }];
    const old = (await f.completion(b)).ref;
    const before = f.fetches.length;
    expect((await b.repair(crypto.randomUUID())).repair).toBe('complete');
    const requested = f.fetches.slice(before);
    expect(requested).toHaveLength(1);
    expect(new URL(requested[0].url).pathname).toMatch(/^\/assets\/index-.*\.js$/);
    expect(requested[0].credentials).toBe('omit');
    expect(requested[0].redirect).toBe('error');
    expect(requested[0].headers.has('authorization')).toBe(false);
    expect(await (await b.respond(navigation(), 'incoming'))!.text()).toBe('v1:/');
    const restart = await f.engine('v2');
    expect(await (await restart.respond(navigation(), 'incoming'))!.text()).toBe('v1:/');
    f.windows = [];
    // A reload replaces an existing window; it is not a close/reopen boundary.
    expect(await (await restart.respond(navigation(), 'incoming', 'open'))!.text()).toBe('v1:/');
    expect(await (await restart.respond(navigation(), 'incoming'))!.text()).toBe('v2:/');
    expect((await f.completion(restart)).body.fallback).toBe(old);
  });
  it.each(['offline', 'failed', 'timeout', 'cancelled', 'blocked'] as const)(
    'bounds %s repair without selecting staging or deleting working resources',
    async (outcome) => {
      const f = new StaticFixture();
      const a = await f.engine('v1');
      await a.install();
      await a.activate();
      const b = await f.engine('v2');
      await b.install();
      await f.damage(b, 'missing', true);
      await b.activate();
      const selected = (await f.completion(b)).ref;
      const path = b.entries.find((e) => /^\/assets\/index-.*\.js$/.test(e.url))!.url;
      if (outcome === 'offline') f.online = false;
      if (outcome === 'failed') f.failPath = path;
      if (outcome === 'timeout' || outcome === 'cancelled') f.delayPath = path;
      const request = crypto.randomUUID();
      const pending = b.repair(request, outcome === 'blocked');
      if (outcome === 'cancelled') {
        await new Promise((r) => setTimeout(r, 10));
        b.cancel(request);
      }
      const result = await pending;
      expect(result.repair).toBe(outcome === 'timeout' ? 'cancelled' : outcome);
      expect((await f.completion(b)).ref).toBe(selected);
      expect(await b.verify(await b.snapshot(), selected)).toBe(true);
      const count = f.fetches.length;
      const restarted = await f.engine('v2');
      await restarted.status();
      expect(f.fetches).toHaveLength(count);
      if (!['offline', 'blocked'].includes(outcome)) {
        await restarted.repair(request);
        expect(f.fetches).toHaveLength(count);
      }
    },
  );
  it('persists the attempt before requests and prevents interrupted attempt replay', async () => {
    const f = new StaticFixture();
    const e = await f.engine('v1');
    await e.install();
    await e.activate();
    await f.damage(e);
    f.failKind = 'finish';
    const request = crypto.randomUUID();
    await e.repair(request);
    const rows = await f.records();
    expect(rows.some((r) => r.body.kind === 'attempt' && r.body.request === request)).toBe(true);
    expect(rows.some((r) => r.body.kind === 'finish')).toBe(false);
    f.failKind = '';
    const count = f.fetches.length;
    const restarted = await f.engine('v1');
    await restarted.repair(request);
    expect(f.fetches).toHaveLength(count);
    expect((await f.completion(restarted)).body.sequence).toBe(0);
  });
  it('serializes concurrent startup/status/fetch/repair/cleanup and allows only one repair flight', async () => {
    const f = new StaticFixture();
    const e = await f.engine('v1');
    await Promise.all([e.initialize(), e.initialize()]);
    await e.install();
    await e.activate();
    await f.damage(e);
    f.delayPath = e.entries.find((r) => r.url.endsWith('.js'))!.url;
    const first = e.repair(crypto.randomUUID());
    await new Promise((r) => setTimeout(r, 5));
    const second = await e.repair(crypto.randomUUID());
    expect(second.repair).toBe('busy');
    await first;
    const results = await Promise.all([e.status(), e.respond(navigation()), e.cleanup()]);
    expect(results[0]).toHaveProperty('ready');
    expect((await f.records()).filter((r) => r.body.kind === 'select')).toHaveLength(1);
  });
  it.each([
    'structure',
    'schema',
    'configuration',
    'origin',
    'scope',
    'generation',
    'mapping',
    'mime',
    'integrity',
    'completion',
    'ambiguity',
  ] as const)('rejects %s metadata without guessing migration or cleanup', async (corruption) => {
    const f = new StaticFixture();
    const e = await f.engine('v1');
    await e.install();
    await e.activate();
    const rows = await f.records();
    const complete = rows.find((r) => r.body.kind === 'complete')!;
    const body = JSON.parse(JSON.stringify(complete.body));
    if (corruption === 'structure') body.extra = 'unexpected';
    if (corruption === 'schema') body.schema = 99;
    if (corruption === 'configuration') body.compatibility = 'b'.repeat(64);
    if (corruption === 'origin') body.origin = 'https://other.example.test';
    if (corruption === 'scope') body.descriptor.scope = '/other/';
    if (corruption === 'generation') body.descriptor.generation = 'b'.repeat(64);
    if (corruption === 'mapping') body.descriptor.entries[0].key = '/index.html';
    if (corruption === 'mime') body.descriptor.entries[0].type = 'application/json';
    if (corruption === 'integrity') body.descriptor.entries[0].integrity = 'opaque';
    if (corruption === 'completion') body.reservation = 'b'.repeat(64);
    if (corruption === 'ambiguity') {
      const head = rows.find((r) => r.body.kind === 'select')!;
      const fork = { ...head.body, era: crypto.randomUUID() };
      const id = await digest(canonical(fork));
      f.stores.get(META)!.set(
        metadataURL(origin, id),
        new Response(canonical({ id, body: fork }), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    } else await f.mutate(complete, body);
    const restarted = await f.engine('v1');
    expect((await restarted.status()).ready).toBe(false);
    const count = f.stores.size;
    expect(await restarted.cleanup()).toBe(false);
    expect(f.stores.size).toBe(count);
  });
  it('does not route metadata, index.html, APIs, queries, cross-origin, authorization or non-GET responses', async () => {
    const f = new StaticFixture();
    const e = await f.engine('v1');
    await e.install();
    await e.activate();
    for (const path of [
      '/index.html',
      '/unknown',
      '/api/user',
      '/auth/v1/token',
      '/__spendspacey_static_v2__/private',
      '/?code=private',
    ])
      expect(await e.respond(new Request(origin + path))).toBeUndefined();
    expect(await e.respond(new Request('https://auth.example.test/auth/v1/token'))).toBeUndefined();
    expect(
      await e.respond(new Request(origin + '/', { headers: { authorization: 'Bearer private' } })),
    ).toBeUndefined();
    expect(await e.respond(new Request(origin + '/', { method: 'POST' }))).toBeUndefined();
    const response = await e.respond(navigation('/auth/callback?code=private'));
    expect(response!.headers.get('cache-control')).toBe('no-store');
    expect(response!.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await response!.text()).toBe('v1:/');
  });
  it('keeps a pinned damaged selection across restart while a live window exists, then recovers only after closure', async () => {
    const f = new StaticFixture();
    const a = await f.engine('v1');
    await a.install();
    await a.activate();
    const b = await f.engine('v2');
    await b.install();
    await b.activate();
    const selected = (await f.completion(b)).ref;
    await f.damage(b);
    f.windows = [{ id: 'hidden', url: origin + '/', visibilityState: 'hidden' }];
    const restart = await f.engine('v2');
    expect((await restart.status()).ready).toBe(false);
    expect((await restart.respond(navigation(), 'new'))!.type).toBe('error');
    expect((await f.completion(restart)).ref).toBe(selected);
    f.windows = [];
    expect(await (await restart.respond(navigation(), 'new'))!.text()).toBe('v1:/');
    expect((await restart.status()).ready).toBe(true);
  });
  it('does not block the current offline shell on another worker installation network I/O', async () => {
    const f = new StaticFixture();
    const a = await f.engine('v1');
    await a.install();
    await a.activate();
    const b = await f.engine('v2');
    f.delayPath = b.entries.find((e) => /^\/assets\/index-.*\.js$/.test(e.url))!.url;
    f.busy = true;
    const installation = b.install();
    while (!f.releaseDelay) await new Promise((resolve) => setTimeout(resolve, 1));
    expect(await (await a.respond(navigation()))!.text()).toBe('v1:/');
    expect((await a.status()).ready).toBe(true);
    expect(await a.cleanup()).toBe(false);
    f.releaseDelay();
    await installation;
    f.busy = false;
    await b.activate();
    expect(await (await b.respond(navigation()))!.text()).toBe('v2:/');
  });
  it.each(['mime', 'bytes', 'redirect', 'opaque', 'url'])(
    'rejects %s responses without damaging a usable predecessor',
    async (kind) => {
      const f = new StaticFixture();
      const a = await f.engine('v1');
      await a.install();
      await a.activate();
      const b = await f.engine('v2');
      f.transform = (_request, response) => {
        if (kind === 'mime')
          return new Response('<html>fallback</html>', {
            headers: { 'content-type': 'text/html' },
          });
        if (kind === 'bytes') return new Response('private', { headers: response.headers });
        Object.defineProperty(
          response,
          kind === 'redirect' ? 'redirected' : kind === 'opaque' ? 'type' : 'url',
          { value: kind === 'redirect' ? true : kind === 'opaque' ? 'opaque' : origin + '/wrong' },
        );
        return response;
      };
      await expect(b.install()).rejects.toThrow();
      expect(await (await a.respond(navigation()))!.text()).toBe('v1:/');
      expect((await a.status()).ready).toBe(true);
    },
  );
  it('does not rely on enumeration order or accept a configuration/deployment boundary mismatch', async () => {
    const f = new StaticFixture();
    const e = await f.engine('v1');
    await e.install();
    await e.activate();
    const rows = f.stores.get(META)!;
    f.stores.set(META, new Map([...rows].reverse()));
    const restart = await f.engine('v1');
    expect((await restart.status()).ready).toBe(true);
    const changed = await f.engine('v1', await digest('other-backend-or-deployment-policy'));
    expect((await changed.status()).ready).toBe(false);
    expect(await changed.cleanup()).toBe(false);
  });
  it('defers cleanup when its retained fallback was corrupted after activation', async () => {
    const f = new StaticFixture();
    const a = await f.engine('v1');
    await a.install();
    await a.activate();
    const old = (await f.completion(a)).ref;
    const b = await f.engine('v2');
    await b.install();
    await b.activate();
    const c = await f.engine('v3');
    await c.install();
    await c.activate();
    await f.damage(b, 'bytes', true);
    expect(await c.cleanup()).toBe(false);
    expect(await c.verify(await c.snapshot(), old)).toBe(true);
  });
  it('defers repair and cleanup without an origin-wide coordinator', async () => {
    const f = new StaticFixture();
    const a = await f.engine('v1');
    a.host.locks = undefined;
    await a.install();
    await a.activate();
    expect((await a.status()).ready).toBe(true);
    expect((await a.repair(crypto.randomUUID())).repair).toBe('blocked');
    expect(await a.cleanup()).toBe(false);
  });
  it('rejects stale activation tickets and concurrent older-worker mutations after a newer commit', async () => {
    const f = new StaticFixture();
    const a = await f.engine('v1');
    await a.install();
    await a.activate();
    const b = await f.engine('v2');
    await b.install();
    const c = await f.engine('v3');
    await c.install();
    await c.activate();
    const selected = (await f.completion(c)).ref;
    const before = (await f.records()).filter((r) => r.body.kind === 'select').length;
    await Promise.all([
      b.activate(),
      a.initialize(),
      a.status(),
      a.cleanup(),
      a.repair(crypto.randomUUID()),
    ]);
    expect((await f.records()).filter((r) => r.body.kind === 'select')).toHaveLength(before);
    expect((await f.completion(c)).ref).toBe(selected);
    expect(await (await c.respond(navigation()))!.text()).toBe('v3:/');
    expect((await b.status()).ready).toBe(false);
    const restart = await f.engine('v3');
    expect(await (await restart.respond(navigation()))!.text()).toBe('v3:/');
  });
  it('rejects a self-consistent metadata graph whose worker implementation identity does not bind the inventory', async () => {
    const f = new StaticFixture();
    const e = await f.engine('v1');
    await e.install();
    await e.activate();
    const rows = await f.records();
    const reserve = rows.find((r) => r.body.kind === 'reserve')!;
    const complete = rows.find((r) => r.body.kind === 'complete')!;
    const select = rows.find((r) => r.body.kind === 'select')!;
    const reservation = { ...reserve.body, implementation: await digest('unsupported-worker') };
    const completion = { ...complete.body, reservation: await digest(canonical(reservation)) };
    const selection = {
      ...select.body,
      selected: await digest(canonical(completion)),
      installation: await digest(canonical(reservation)),
    };
    await f.mutate(reserve, reservation);
    await f.mutate(complete, completion);
    await f.mutate(select, selection);
    const restart = await f.engine('v1');
    expect((await restart.status()).ready).toBe(false);
    expect(await restart.cleanup()).toBe(false);
    expect((await restart.respond(navigation()))!.type).toBe('error');
  });
});
