import { describe, it, expect } from 'vitest';
import { StaticFixture, origin, navigation } from '../../test/staticGenerations';
import { Generations } from '../../worker/generations';
import {
  META,
  LOCK,
  metadataURL,
  resourceName,
  canonical,
  digest,
  type Stored,
} from '../../worker/schema';
import {
  recoveryHTML,
  recoveryDocument,
  recoveryScript,
  recoveryStyle,
} from '../../worker/recovery';
import { Generations as Legacy } from '../../test/legacy-v2/generations';

async function ready(f = new StaticFixture(), version = 'v1') {
  const g = await f.engine(version);
  await g.install();
  await g.activate();
  return { f, g };
}
async function root(g: Generations, id = 'document-1', path = '/') {
  return (await g.respond(navigation(path), id))!;
}
async function asset(
  g: Generations,
  id = 'document-1',
  path = g.entries.find((e) => e.url.endsWith('.js') && !e.url.includes('supabase'))!.url,
) {
  return (await g.respond(new Request(origin + path), '', id))!;
}
async function recovery(f: StaticFixture, g: Generations, id = 'recovery-1') {
  await f.damage(g, 'missing', false, '/assets/supabase-sharedxx.js');
  expect(await (await root(g, id)).text()).toBe(recoveryHTML);
  return (await g.status(id)).binding!;
}
async function rpc(
  g: Generations,
  id: string,
  operation: string,
  request = crypto.randomUUID(),
  overrides = {},
) {
  const s = await g.status(id);
  return g.message(
    {
      protocol: 3,
      operation,
      request,
      ...(operation === 'HELLO' ? {} : { worker: s.worker, epoch: s.epoch, binding: s.binding }),
      ...overrides,
    },
    { id, url: origin + '/' },
    origin,
  );
}
async function repaired() {
  const { f, g } = await ready();
  const binding = await recovery(f, g);
  const result = await g.repair(crypto.randomUUID(), 'recovery-1', binding);
  expect(result.repair).toBe('complete');
  return { f, g, binding };
}
async function selected(g: Generations) {
  const s = await g.snapshot();
  const b = s.selection!.body;
  if (b.kind !== 'activate' && b.kind !== 'deliver') throw Error();
  return b;
}
async function legacy(f: StaticFixture) {
  await f.engine('old');
  const inv = f.inventories.get('old')!;
  const entries = inv.map(({ url, key, revision, integrity, type, bytes }) => ({
    url,
    key,
    revision,
    integrity,
    type,
    bytes,
  }));
  const compatibility = inv[0].legacyCompatibility;
  const implementation = inv[0].implementation;
  const worker = await digest(canonical({ entries, compatibility, implementation }));
  const g = new Legacy(
    f.host(),
    entries.map((e) => ({ ...e, compatibility, implementation, worker })),
  );
  await g.install();
  await g.activate();
  return g;
}

describe('immutable document generation ownership', () => {
  it('prepares completely on the first visit and controls the next ordinary offline load without claim', async () => {
    const { f, g } = await ready();
    expect((await g.status()).prepared).toBe(true);
    expect((await g.status()).ready).toBe(false);
    expect(f.fetches).toHaveLength(g.entries.length);
    f.online = false;
    expect(await (await root(g)).text()).toBe('v1:/');
    expect((await g.status('document-1')).ready).toBe(true);
    expect(await (await asset(g)).text()).toContain('v1:');
  });
  it('uses canonical / only with exact MIME, integrity, omit credentials and redirect error', async () => {
    const { f, g } = await ready();
    expect(f.fetches.map((r) => new URL(r.url).pathname)).toEqual(g.entries.map((e) => e.url));
    for (const r of f.fetches) {
      expect(r.credentials).toBe('omit');
      expect(r.redirect).toBe('error');
      expect(r.integrity).toMatch(/^sha256-/);
    }
    expect(g.entries.some((e) => e.url === '/index.html')).toBe(false);
  });
  it.each(['missing', 'bytes'] as const)(
    'serves independent recovery for a %s lazy Auth chunk online and offline',
    async (kind) => {
      const { f, g } = await ready();
      await f.damage(g, kind, false, '/assets/supabase-sharedxx.js');
      for (const online of [true, false]) {
        f.online = online;
        const before = f.fetches.length;
        const response = await root(g, 'cold-' + online);
        expect(await response.text()).toBe(recoveryHTML);
        expect(f.fetches.length).toBe(before);
        expect((await g.status('cold-' + online)).authority).toBe('recovery');
      }
    },
  );
  it.each(['/', '/assets/index-v1xxxxxx.js'])(
    'does not depend on missing or corrupted %s',
    async (path) => {
      for (const kind of ['missing', 'bytes'] as const) {
        const { f, g } = await ready();
        await f.damage(g, kind, false, path);
        expect(await (await root(g)).text()).toBe(recoveryHTML);
        expect(f.fetches).toHaveLength(g.entries.length);
      }
    },
  );
  it('cold online/offline restart remains recoverable with no complete fallback', async () => {
    const { f, g } = await ready();
    await recovery(f, g);
    for (const online of [true, false]) {
      f.online = online;
      const restarted = await f.engine('v1');
      await restarted.initialize();
      expect(await (await root(restarted, 'reopen-' + online)).text()).toBe(recoveryHTML);
    }
  });
  it.each(['missing', 'bytes'] as const)(
    'damaged waiting replacement (%s) retains the verified predecessor after offline activation',
    async (kind) => {
      const { f, g } = await ready();
      const next = await f.engine('v2');
      await next.install();
      await f.damage(next, kind, true);
      f.online = false;
      await next.activate();
      expect(await (await root(next, 'new')).text()).toBe('v1:/');
      expect(
        await (
          await asset(
            next,
            'new',
            g.entries.find((e) => e.url.includes('index-') && e.url.endsWith('.js'))!.url,
          )
        ).text(),
      ).toContain('v1:');
    },
  );
  it('retains pinned v1 documents while new documents adopt v2 and v1 rollback', async () => {
    const { f, g } = await ready();
    await root(g, 'old');
    const v2 = await f.engine('v2');
    await v2.install();
    await v2.activate();
    expect(await (await root(v2, 'middle')).text()).toBe('v2:/');
    expect(
      await (
        await asset(
          v2,
          'old',
          g.entries.find((e) => e.url.endsWith('.js') && !e.url.includes('supabase'))!.url,
        )
      ).text(),
    ).toContain('v1:');
    const rollback = await f.engine('v1');
    await rollback.install();
    await rollback.activate();
    expect(await (await root(rollback, 'rollback')).text()).toBe('v1:/');
    expect(
      await (
        await asset(
          rollback,
          'middle',
          v2.entries.find((e) => e.url.endsWith('.js') && !e.url.includes('supabase'))!.url,
        )
      ).text(),
    ).toContain('v2:');
  });
  it('fails missing, conflicting or unknown subresource bindings closed without network or latest-selection substitution', async () => {
    const { f, g } = await ready();
    for (const id of ['', 'pre-pin', 'restored-legacy'])
      expect((await asset(g, id)).type).toBe('error');
    expect(f.fetches).toHaveLength(g.entries.length);
    await root(g, 'old');
    expect((await asset(g, 'old', '/assets/index-missingxx.js')).type).toBe('error');
  });
  it('routes subresources immediately after binding, before enumeration, confirmation or handled', async () => {
    const { f, g } = await ready();
    f.windows = [{ id: 'old', url: origin + '/', visibilityState: 'hidden' }];
    await root(g, 'new');
    expect(await (await asset(g, 'new')).text()).toContain('v1:');
    expect((await g.snapshot()).chain.some((r) => r.body.kind === 'confirm')).toBe(false);
  });
  it('confirmation and handled success/failure add evidence without changing or retiring ownership', async () => {
    const { g } = await ready();
    await root(g);
    const binding = (await g.status('document-1')).binding;
    await rpc(g, 'document-1', 'CONFIRM');
    await g.evidence('document-1', 'handled');
    await g.evidence('document-1', 'handling-error');
    expect((await g.status('document-1')).binding).toBe(binding);
    expect(await (await asset(g)).text()).toContain('v1:');
  });
  it('repaired files become usable on WebKit-style fresh navigation/reload while ambiguous old bindings remain pinned', async () => {
    const { f, g } = await repaired();
    const old = (await g.status('recovery-1')).binding;
    const restarted = await f.engine('v1');
    await restarted.initialize();
    expect(await (await root(restarted, 'new-navigation')).text()).toBe('v1:/');
    expect((await restarted.status('recovery-1')).binding).toBe(old);
    expect((await restarted.status('recovery-1')).authority).toBe('recovery');
    expect((await restarted.status('new-navigation')).ready).toBe(true);
    const again = await f.engine('v1');
    await again.initialize();
    expect((await again.status('new-navigation')).ready).toBe(true);
  });
  it('existing unusable application pin does not switch after repair; only a new document adopts it', async () => {
    const { f, g } = await ready();
    await root(g, 'existing');
    const old = (await g.status('existing')).generation;
    const binding = await recovery(f, g);
    expect((await g.status('existing')).ready).toBe(false);
    await g.repair(crypto.randomUUID(), 'recovery-1', binding);
    expect((await asset(g, 'existing')).type).toBe('error');
    await root(g, 'new');
    expect((await g.status('new')).generation).not.toBe(old);
    expect((await g.status('existing')).generation).toBe(old);
  });
  it('empty/invalid/duplicate resulting IDs grant guidance only; later valid navigation can progress', async () => {
    const { g } = await repaired();
    for (const id of ['', 'bad/id']) expect(await (await root(g, id)).text()).toBe(recoveryHTML);
    expect((await g.status('')).binding).toBeNull();
    await root(g, 'valid');
    expect(await (await root(g, 'valid')).text()).toBe(recoveryHTML);
    expect(await (await root(g, 'later')).text()).toBe('v1:/');
  });
  it('simultaneous fresh navigations commit one compatible selection and separate immutable pins', async () => {
    const { g } = await repaired();
    const responses = await Promise.all(['a', 'b'].map((id) => root(g, id)));
    for (const r of responses) expect(await r.text()).toBe('v1:/');
    expect((await g.status('a')).generation).toBe((await g.status('b')).generation);
    expect((await g.status('a')).binding).not.toBe((await g.status('b')).binding);
  });
  it('does not await absent or hanging get/enumeration to deliver or promote', async () => {
    const { f, g } = await repaired();
    f.host = () => {
      throw Error('Do not re-read host');
    };
    g.host.windows = () => new Promise(() => {});
    const cleaning = g.cleanup();
    void cleaning;
    await Promise.resolve();
    expect(await (await root(g, 'fresh')).text()).toBe('v1:/');
  });
  it('frozen, BFCache, hidden, uncontrolled and unresponsive clients retain pins despite absence', async () => {
    const { f, g } = await ready();
    await root(g, 'frozen');
    await rpc(g, 'frozen', 'CONFIRM');
    f.windows = [];
    const v2 = await f.engine('v2');
    await v2.install();
    await v2.activate();
    await root(v2, 'second');
    const v3 = await f.engine('v3');
    await v3.install();
    await v3.activate();
    await v3.cleanup();
    expect(
      await (
        await asset(
          v3,
          'frozen',
          g.entries.find((e) => e.url.endsWith('.js') && !e.url.includes('supabase'))!.url,
        )
      ).text(),
    ).toContain('v1:');
  });
});

describe('strict recovery and deliberate bounded repair', () => {
  it('has exact self-contained hashed CSP and no-store/no-referrer response policy', async () => {
    const r = await recoveryDocument(),
      h = r.headers;
    expect(h.get('content-type')).toBe('text/html; charset=utf-8');
    expect(h.get('cache-control')).toBe('no-store');
    expect(h.get('referrer-policy')).toBe('no-referrer');
    expect(h.get('x-frame-options')).toBe('DENY');
    expect(h.get('x-content-type-options')).toBe('nosniff');
    const b64 = async (v: string) =>
      'sha256-' +
      btoa(String.fromCharCode(...(await digest(v)).match(/../g)!.map((x) => parseInt(x, 16))));
    expect(h.get('content-security-policy')).toBe(
      `default-src 'none'; script-src '${await b64(recoveryScript)}'; style-src '${await b64(recoveryStyle)}'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    );
    expect(recoveryHTML).not.toMatch(
      /<script[^>]+src=| on\w+=|<link|import\(|supabase\.|getSession|access_token/,
    );
  });
  it('persists attempt before requests, repairs exact inventory, and does not execute the static SDK', async () => {
    const { f, g } = await ready();
    const binding = await recovery(f, g);
    const before = f.fetches.length;
    const request = crypto.randomUUID();
    let persisted = false;
    f.transform = (req, response) => {
      persisted = [...(f.stores.get(META)?.values() ?? [])].length > 0;
      expect(req.url).toBe(origin + '/assets/supabase-sharedxx.js');
      return response;
    };
    expect((await g.repair(request, 'recovery-1', binding)).repair).toBe('complete');
    expect(persisted).toBe(true);
    expect(f.fetches.length - before).toBe(1);
    expect((await g.repair(request, 'recovery-1', binding)).repair).toBe('complete');
    expect(f.fetches.length - before).toBe(1);
  });
  it.each(['failed', 'timed-out', 'cancelled', 'offline', 'unknown'] as const)(
    'reports %s without automatic retry or lock release by page timeout',
    async (outcome) => {
      const { f, g } = await ready();
      const binding = await recovery(f, g);
      const request = crypto.randomUUID();
      if (outcome === 'offline') f.online = false;
      else if (outcome === 'failed') f.failPath = '/assets/supabase-sharedxx.js';
      else if (outcome === 'unknown') {
        f.failPath = '/assets/supabase-sharedxx.js';
        f.failKind = 'finish';
      } else {
        f.delayPath = '/assets/supabase-sharedxx.js';
        f.deadline = 20;
        g.host.repairDeadline = 20;
      }
      const pending = g.repair(request, 'recovery-1', binding);
      if (outcome === 'cancelled') {
        while (!f.releaseDelay) await new Promise((r) => setTimeout(r, 1));
        expect((await g.repair(crypto.randomUUID(), 'recovery-1', binding)).repair).toBe('busy');
        await rpc(g, 'recovery-1', 'CANCEL');
      }
      const result = await pending;
      expect(result.repair).toBe(outcome);
      const count = f.fetches.length;
      f.failKind = '';
      const restarted = await f.engine('v1');
      await restarted.initialize();
      await restarted.status('recovery-1');
      await root(restarted, 'reloaded');
      expect(f.fetches).toHaveLength(count);
    },
  );
  it('interrupted attempts stay spent after restart and duplicate request cannot start again', async () => {
    const { f, g } = await ready();
    const binding = await recovery(f, g);
    f.failKind = 'reserve';
    const request = crypto.randomUUID();
    expect((await g.repair(request, 'recovery-1', binding)).repair).toBe('failed');
    const count = f.fetches.length;
    f.failKind = '';
    const restart = await f.engine('v1');
    await restart.initialize();
    await restart.repair(request, 'recovery-1', binding);
    expect(f.fetches.length).toBe(count);
  });
  it('completed staging corrupted before selection is never selected', async () => {
    const { f, g } = await repaired();
    const selectedBefore = (await selected(g)).selected;
    await f.damage(g, 'bytes', true);
    const r = await root(g, 'new');
    expect(await r.text()).toBe(recoveryHTML);
    expect((await selected(g)).selected).toBe(selectedBefore);
  });
  it.each([
    'wrong-origin',
    'wrong-source',
    'wrong-binding',
    'wrong-worker',
    'wrong-epoch',
    'extra-field',
    'legacy',
  ] as const)('rejects %s message authority', async (kind) => {
    const { f, g } = await ready();
    await recovery(f, g);
    const s = await g.status('recovery-1');
    const data: Record<string, unknown> = {
      protocol: 3,
      operation: 'REPAIR',
      request: crypto.randomUUID(),
      worker: s.worker,
      epoch: s.epoch,
      binding: s.binding,
    };
    let source = { id: 'recovery-1', url: origin + '/' };
    let from = origin;
    if (kind === 'wrong-origin') from = 'https://evil.test';
    if (kind === 'wrong-source') source = { id: 'other', url: origin + '/' };
    if (kind === 'wrong-binding') data.binding = 'a'.repeat(64);
    if (kind === 'wrong-worker') data.worker = 'b'.repeat(64);
    if (kind === 'wrong-epoch') data.epoch = crypto.randomUUID();
    if (kind === 'extra-field') data.client = 'recovery-1';
    if (kind === 'legacy') {
      delete data.protocol;
      data.type = 'REPAIR';
    }
    const count = f.fetches.length;
    expect(await g.message(data, source, from)).toBeUndefined();
    expect(f.fetches.length).toBe(count);
  });
  it('status is read-only and replayed confirmation IDs cannot become repair attempts', async () => {
    const { f, g } = await ready();
    await recovery(f, g);
    const id = crypto.randomUUID();
    await rpc(g, 'recovery-1', 'CONFIRM', id);
    const before = (await g.snapshot()).head!.id;
    await rpc(g, 'recovery-1', 'STATUS');
    expect((await g.snapshot()).head!.id).toBe(before);
    await rpc(g, 'recovery-1', 'REPAIR', id);
    expect((await g.snapshot()).head!.id).toBe(before);
  });
});

describe('storage interruptions, fencing, and callback delivery', () => {
  it.each(['navigation', 'deliver'] as const)(
    'interruption before/after %s persistence never releases unbound application bytes',
    async (kind) => {
      for (const timing of ['beforePut', 'afterPut']) {
        const { f, g } = await ready();
        f.hook = async (point, name, _key, response) => {
          if (
            point === timing &&
            name === META &&
            response &&
            (JSON.parse(await response.clone().text()) as Stored).body.kind === kind
          )
            throw Error('termination');
        };
        expect(await (await root(g, 'interrupted')).text()).toBe(recoveryHTML);
        f.hook = undefined;
        const s = await g.snapshot();
        const b = s.bindings.get('interrupted');
        if (b) expect(b.body.kind).toBe('deliver');
        else expect((await asset(g, 'interrupted')).type).toBe('error');
        const restart = await f.engine('v1');
        await restart.initialize();
        expect(await (await root(restart, 'later')).text()).toBe('v1:/');
      }
    },
  );
  it.each(['reserve', 'complete', 'activate'] as const)(
    'restart at generation %s persistence keeps partial state unselected',
    async (kind) => {
      const f = new StaticFixture(),
        g = await f.engine('v1');
      f.failKind = kind;
      await expect(
        kind === 'activate' ? g.install().then(() => g.activate()) : g.install(),
      ).rejects.toThrow();
      f.failKind = '';
      const restart = await f.engine('v1');
      await restart.initialize();
      expect(await (await root(restart)).text()).toBe(recoveryHTML);
    },
  );
  it.each(['quota', 'readback', 'eviction'] as const)(
    'handles %s during joint commit without application delivery',
    async (kind) => {
      const { f, g } = await ready();
      let active = false;
      f.hook = async (point, name, key, response) => {
        if (name !== META) return;
        if (
          point === 'beforePut' &&
          response &&
          (JSON.parse(await response.clone().text()) as Stored).body.kind === 'deliver'
        ) {
          active = true;
          if (kind === 'quota') throw new DOMException('Quota', 'QuotaExceededError');
        }
        if (active && point === 'afterPut' && kind === 'eviction') f.stores.delete(META);
        if (active && point === 'match' && kind === 'readback')
          f.stores
            .get(META)
            ?.set(key, new Response('{}', { headers: { 'content-type': 'application/json' } }));
      };
      expect(await (await root(g)).text()).toBe(recoveryHTML);
      expect(f.fetches.length).toBe(g.entries.length);
    },
  );
  it('missing resource eviction after joint persistence never releases cached HTML', async () => {
    const { f, g } = await ready();
    f.hook = async (point, name, _key, response) => {
      if (
        name === META &&
        point === 'afterPut' &&
        response &&
        (JSON.parse(await response.clone().text()) as Stored).body.kind === 'deliver'
      ) {
        for (const [key, rows] of f.stores)
          if (key.includes('resource-v3')) rows.delete(origin + '/');
      }
    };
    expect(await (await root(g)).text()).toBe(recoveryHTML);
  });
  it('restores from immutable lineage with no head pointer and rejects a stale/foreign mutable pointer', async () => {
    const { f, g } = await ready();
    await root(g);
    const restart = await f.engine('v1');
    await restart.initialize();
    expect((await restart.status('document-1')).ready).toBe(true);
    f.stores
      .get(META)!
      .set(
        origin + '/head',
        new Response('{}', { headers: { 'content-type': 'application/json' } }),
      );
    expect((await restart.status('document-1')).repair).toBe('unavailable');
  });
  it.each(['fork', 'missing', 'corrupt', 'unsupported', 'configuration'] as const)(
    'rejects %s ledger state and disables unsafe repair',
    async (kind) => {
      const { f, g } = await ready();
      await root(g);
      const rows = f.stores.get(META)!;
      const records = await f.records();
      const last = records.at(-1)!;
      if (kind === 'missing') rows.delete(metadataURL(origin, records[0].id));
      else if (kind === 'corrupt')
        rows.set(
          metadataURL(origin, last.id),
          new Response('{}', { headers: { 'content-type': 'application/json' } }),
        );
      else if (kind === 'fork') {
        const body = { ...last.body, worker: 'a'.repeat(64) };
        const id = await digest(canonical(body));
        rows.set(
          metadataURL(origin, id),
          new Response(canonical({ id, body }), {
            headers: { 'content-type': 'application/json' },
          }),
        );
      } else {
        const body = {
          ...last.body,
          ...(kind === 'unsupported' ? { schema: 4 } : { compatibility: 'b'.repeat(64) }),
        };
        await f.mutate(last, body);
      }
      const restart = await f.engine('v1');
      await restart.initialize();
      expect(await (await root(restart, 'new')).text()).toBe(recoveryHTML);
      expect((await restart.status('new')).repair).toBe('unavailable');
    },
  );
  it('fails closed when shared serialization is absent, or unsupported newer ownership exists', async () => {
    const f = new StaticFixture();
    const g = await f.engine('v1');
    g.host.locks = undefined;
    await expect(g.install()).rejects.toThrow();
    expect(await (await root(g)).text()).toBe(recoveryHTML);
    expect(f.fetches).toHaveLength(0);
    const { f: other, g: active } = await ready();
    other.stores.set('spendspacey-static-ownership-v4', new Map());
    expect((await asset(active)).type).toBe('error');
    expect(await (await root(active, 'new')).text()).toBe(recoveryHTML);
  });
  it('fences older delayed activation, evidence, repair and navigation writers after a new epoch', async () => {
    const { f, g } = await ready();
    await root(g, 'old');
    const delayed = await f.engine('delayed');
    await delayed.install();
    const newer = await f.engine('newer');
    await newer.install();
    await newer.activate();
    const head = (await newer.snapshot()).head!.id;
    await expect(delayed.activate()).rejects.toThrow();
    await g.evidence('old', 'handled');
    expect(await (await root(g, 'stale')).text()).toBe(recoveryHTML);
    expect((await newer.snapshot()).head!.id).toBe(head);
  });
  it('callback commits binding before bytes and first subresource without selection promotion or OAuth persistence', async () => {
    const { f, g } = await repaired();
    const before = (await selected(g)).selected;
    const r = await root(g, 'callback', '/auth/callback?code=RAW_SECRET&state=RAW_STATE');
    expect(r.type).toBe('error');
    // A healthy selected generation permits callback cloning, independently of pending repair.
    const healthy = await ready();
    const callback = await root(
      healthy.g,
      'callback',
      '/auth/callback?code=RAW_SECRET&state=RAW_STATE',
    );
    expect(callback.headers.get('cache-control')).toBe('no-store');
    expect(callback.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await (await asset(healthy.g, 'callback')).text()).toContain('v1:');
    expect((await selected(g)).selected).toBe(before);
    const raw = await Promise.all(
      [...f.stores.values(), ...healthy.f.stores.values()].flatMap((rows) =>
        [...rows.values()].map((r) => r.clone().text()),
      ),
    );
    expect(raw.join()).not.toMatch(/RAW_SECRET|RAW_STATE|auth\/callback/);
  });
  it('callback persistence failure and corrupted callback document fail closed with no recovery substitution', async () => {
    const { f, g } = await ready();
    f.failKind = 'deliver';
    expect((await root(g, 'callback', '/auth/callback?code=private')).type).toBe('error');
    f.failKind = '';
    await f.damage(g, 'bytes', false, '/');
    expect((await root(g, 'callback-2', '/auth/callback')).type).toBe('error');
    expect((await asset(g, 'callback')).type).toBe('error');
  });
});

describe('deletion sealing and explicit 069dbc50 cutover', () => {
  it('retains three generations while confirmed/ambiguous documents reference each one', async () => {
    const { f, g } = await ready();
    await root(g, 'a');
    await rpc(g, 'a', 'CONFIRM');
    const v2 = await f.engine('v2');
    await v2.install();
    await v2.activate();
    await root(v2, 'b');
    const v3 = await f.engine('v3');
    await v3.install();
    await v3.activate();
    await root(v3, 'c');
    f.windows = [];
    await v3.cleanup();
    expect([...f.stores.keys()].filter((n) => n.includes('resource-v3'))).toHaveLength(3);
    expect(
      await (
        await asset(
          v3,
          'a',
          g.entries.find((e) => e.url.endsWith('.js') && !e.url.includes('supabase'))!.url,
        )
      ).text(),
    ).toContain('v1:');
  });
  it('seals only unreferenced historical generations and resumes deletion after restart', async () => {
    const { f } = await ready();
    const v2 = await f.engine('v2');
    await v2.install();
    await v2.activate();
    const v3 = await f.engine('v3');
    await v3.install();
    await v3.activate();
    f.failKind = 'deleted';
    await expect(v3.cleanup()).rejects.toThrow();
    expect((await v3.snapshot()).sealed.size).toBe(1);
    f.failKind = '';
    const restart = await f.engine('v3');
    await restart.initialize();
    await restart.cleanup();
    expect([...f.stores.keys()].filter((n) => n.includes('resource-v3'))).toHaveLength(2);
    expect(await (await root(restart, 'new')).text()).toBe('v3:/');
  });
  it.each(['hidden', 'uncontrolled', 'unresponsive', 'newly-navigating'])(
    'defers new seals with %s windows',
    async (visibility) => {
      const { f } = await ready();
      const v2 = await f.engine('v2');
      await v2.install();
      await v2.activate();
      const v3 = await f.engine('v3');
      await v3.install();
      await v3.activate();
      f.windows = [{ id: visibility, url: origin + '/', visibilityState: 'hidden' }];
      expect(await v3.cleanup()).toBe(false);
      expect((await v3.snapshot()).sealed.size).toBe(0);
    },
  );
  it('binding and cleanup serialize; a pin created first prevents sealing', async () => {
    const { f, g } = await ready();
    await root(g, 'first');
    const v2 = await f.engine('v2');
    await v2.install();
    await v2.activate();
    const v3 = await f.engine('v3');
    await v3.install();
    await v3.activate();
    await Promise.all([root(v3, 'new'), v3.cleanup()]);
    expect((await v3.snapshot()).sealed.size).toBe(0);
    expect(
      await (
        await asset(
          v3,
          'first',
          g.entries.find((e) => e.url.endsWith('.js') && !e.url.includes('supabase'))!.url,
        )
      ).text(),
    ).toContain('v1:');
  });
  it('imports actual 069dbc50 bytes to new-owned storage and protects legacy clients without manufacturing pins', async () => {
    const f = new StaticFixture();
    const old = await legacy(f);
    const oldNames = [...f.stores.keys()];
    const corrected = await f.engine('v2');
    await corrected.install();
    await corrected.activate();
    for (const name of oldNames) expect(f.stores.has(name)).toBe(true);
    expect((await corrected.snapshot()).chain.some((r) => r.body.kind === 'cutover')).toBe(true);
    expect(
      (await asset(corrected, 'live-pre-pin', old.entries.find((e) => e.url.endsWith('.js'))!.url))
        .type,
    ).toBe('error');
    expect(await (await root(corrected, 'new')).text()).toBe('v2:/');
    expect(await corrected.cleanup()).toBe(false);
  });
  it('preserves spent and interrupted v2 attempt history across cutover and rejects legacy controls', async () => {
    const f = new StaticFixture();
    const old = await legacy(f);
    const request = crypto.randomUUID();
    f.failPath = '/';
    await old.repair(request, false);
    f.failPath = '';
    const next = await f.engine('v2');
    await next.install();
    await next.activate();
    const cut = [...(await next.snapshot()).records.values()].find((r) => r.kind === 'cutover');
    expect(cut?.kind === 'cutover' && cut.attempts.some((a) => a.request === request)).toBe(true);
    const count = f.fetches.length;
    expect(
      await next.message(
        { type: 'REPAIR', request, blocked: false },
        { id: 'legacy', url: origin + '/' },
        origin,
      ),
    ).toBeUndefined();
    expect(f.fetches.length).toBe(count);
  });
  it('interrupted import creates no usable imported generation and leaves legacy caches untouched', async () => {
    const f = new StaticFixture();
    await legacy(f);
    const oldNames = [...f.stores.keys()];
    const next = await f.engine('v2');
    f.hook = async (point, name) => {
      if (point === 'beforePut' && name.includes('resource-v3')) throw Error('interrupted copying');
    };
    await expect(next.install()).rejects.toThrow();
    const s = await next.snapshot();
    expect([...s.records.values()].some((r) => r.kind === 'complete')).toBe(false);
    for (const name of oldNames) expect(f.stores.has(name)).toBe(true);
  });
  it('uses the same origin-wide lock as v2 for cutover and excludes immutable sealed generations', async () => {
    expect(LOCK).toBe('spendspacey-static-v2');
    expect(resourceName({ instance: 'one' })).not.toContain('resource-v2');
  });
});

describe('extended interruption and concurrency matrix', () => {
  it.each(['attempt', 'reserve', 'complete', 'finish'] as const)(
    'repair termination around %s keeps the durable budget and forbids partial selection',
    async (boundary) => {
      for (const timing of ['beforePut', 'afterPut']) {
        const { f, g } = await ready();
        const binding = await recovery(f, g);
        let halted = false;
        f.hook = async (point, name, _key, response) => {
          if (name !== META) return;
          if (halted && point === 'beforePut') throw Error('terminated worker');
          if (
            point === timing &&
            response &&
            (JSON.parse(await response.clone().text()) as Stored).body.kind === boundary
          ) {
            halted = true;
            throw Error('termination boundary');
          }
        };
        const count = f.fetches.length;
        const request = crypto.randomUUID();
        await g.repair(request, 'recovery-1', binding);
        f.hook = undefined;
        const restart = await f.engine('v1');
        await restart.initialize();
        const status = await restart.status('recovery-1');
        const s = await restart.snapshot();
        if (status.repair === 'complete')
          expect(await (await root(restart, 'new')).text()).toBe('v1:/');
        else {
          expect(await (await root(restart, 'new')).text()).toBe(recoveryHTML);
          const after = f.fetches.length;
          await restart.status('recovery-1');
          expect(f.fetches.length).toBe(after);
        }
        if (s.chain.some((r) => r.body.kind === 'attempt')) {
          await restart.repair(request, 'recovery-1', binding);
          expect(f.fetches.length).toBeGreaterThanOrEqual(count);
          expect(s.chain.filter((r) => r.body.kind === 'attempt')).toHaveLength(1);
        }
      }
    },
  );
  it.each(['navigation', 'deliver'] as const)(
    'two navigations recover when the first is interrupted at %s',
    async (boundary) => {
      const { f, g } = await repaired();
      let once = false;
      f.hook = async (point, name, _key, response) => {
        if (
          !once &&
          point === 'afterPut' &&
          name === META &&
          response &&
          (JSON.parse(await response.clone().text()) as Stored).body.kind === boundary
        ) {
          once = true;
          throw Error('first interrupted');
        }
      };
      const [a, b] = await Promise.all([root(g, 'a'), root(g, 'b')]);
      expect(await a.text()).toBe(recoveryHTML);
      expect(await b.text()).toBe('v1:/');
      f.hook = undefined;
      const s = await g.snapshot();
      if (boundary === 'navigation')
        expect(s.chain.some((r) => r.body.kind === 'abandon')).toBe(true);
      else expect(s.bindings.has('a')).toBe(true);
    },
  );
  it.each(['confirm', 'evidence'] as const)(
    'termination at %s cannot remove possibly delivered ownership',
    async (boundary) => {
      const { f, g } = await ready();
      await root(g, 'delivered');
      f.failKind = boundary;
      if (boundary === 'confirm') await rpc(g, 'delivered', 'CONFIRM');
      else await g.evidence('delivered', 'handling-error');
      f.failKind = '';
      const restart = await f.engine('v1');
      await restart.initialize();
      expect(await (await asset(restart, 'delivered')).text()).toContain('v1:');
    },
  );
  it('interrupted subresource reads fail closed then recover on the same immutable binding', async () => {
    const { f, g } = await ready();
    await root(g, 'existing');
    let thrown = false;
    f.hook = async (point, name) => {
      if (point === 'match' && name.includes('resource-v3') && !thrown) {
        thrown = true;
        throw Error('terminated fetch');
      }
    };
    expect((await asset(g, 'existing')).type).toBe('error');
    f.hook = undefined;
    const restart = await f.engine('v1');
    await restart.initialize();
    expect(await (await asset(restart, 'existing')).text()).toContain('v1:');
  });
  it('metadata count and byte bounds report unavailable, preserving resources', async () => {
    for (const bound of ['count', 'bytes']) {
      const { f, g } = await ready();
      const rows = f.stores.get(META)!;
      const resources = [...f.stores.keys()].filter((n) => n.includes('resource-v3'));
      if (bound === 'count')
        for (let i = 0; i < 4097; i++)
          rows.set(
            origin + '/invalid/' + i,
            new Response('{}', { headers: { 'content-type': 'application/json' } }),
          );
      else
        rows.set(
          origin + '/oversized',
          new Response('x'.repeat(65537), { headers: { 'content-type': 'application/json' } }),
        );
      expect(await (await root(g, 'new')).text()).toBe(recoveryHTML);
      expect((await g.status()).repair).toBe('unavailable');
      for (const r of resources) expect(f.stores.has(r)).toBe(true);
    }
  });
  it('mismatched backend/deployment/scope boundaries cannot discover or import generations', async () => {
    const { f, g } = await ready();
    await root(g, 'prior');
    for (const policy of [
      'backend-changed',
      'canonical-origin-changed',
      'auth-deployment-changed',
    ]) {
      const incompatible = await f.engine('new', await digest(policy));
      await incompatible.initialize();
      expect(await (await root(incompatible, policy)).text()).toBe(recoveryHTML);
      expect((await incompatible.status()).repair).toBe('unavailable');
    }
    const other = await f.engine('v1');
    other.host.origin = 'https://preview.example.test';
    await other.initialize();
    expect((await other.status()).repair).toBe('unavailable');
  });
  it.each(['mime', 'redirect', 'redirected', 'opaque', 'bytes', 'url', 'status'] as const)(
    'rejects %s static responses without damaging the complete predecessor',
    async (fault) => {
      const { f, g } = await ready();
      const next = await f.engine('v2');
      f.transform = (request, response) => {
        if (new URL(request.url).pathname !== '/') return response;
        if (fault === 'mime')
          return new Response('v2:/', { headers: { 'content-type': 'application/json' } });
        if (fault === 'redirect')
          return new Response('', { status: 308, headers: { location: '/' } });
        if (fault === 'status') return new Response('', { status: 404 });
        if (fault === 'bytes')
          return new Response('wrong', { headers: { 'content-type': 'text/html' } });
        Object.defineProperty(
          response,
          fault === 'url' ? 'url' : fault === 'opaque' ? 'type' : 'redirected',
          {
            value: fault === 'url' ? origin + '/index.html' : fault === 'opaque' ? 'opaque' : true,
          },
        );
        return response;
      };
      await expect(next.install()).rejects.toThrow();
      expect(await (await root(g, 'old')).text()).toBe('v1:/');
    },
  );
  it('selects an intact fallback on a fresh document without rebinding older documents; neither usable gives recovery', async () => {
    const { f, g } = await ready();
    await root(g, 'v1-document');
    const v2 = await f.engine('v2');
    await v2.install();
    await v2.activate();
    await root(v2, 'v2-document');
    await f.damage(v2);
    expect(await (await root(v2, 'rollback')).text()).toBe('v1:/');
    expect((await v2.status('v2-document')).ready).toBe(false);
    await f.damage(v2);
    expect(await (await root(v2, 'neither')).text()).toBe(recoveryHTML);
    expect(await v2.cleanup()).toBe(false);
    expect([...f.stores.keys()].filter((n) => n.includes('resource-v3'))).toHaveLength(2);
  });
  it('an explicit recovery request makes repair reachable while a complete older generation is selected', async () => {
    const { f, g } = await ready();
    const v2 = await f.engine('v2');
    await v2.install();
    await f.damage(v2, 'missing', true);
    await v2.activate();
    expect(await (await root(v2, 'fallback')).text()).toBe('v1:/');
    expect((await v2.status('fallback')).pending).toBe(true);
    await rpc(v2, 'fallback', 'RECOVERY');
    expect(await (await root(v2, 'recovery')).text()).toBe(recoveryHTML);
    const binding = (await v2.status('recovery')).binding!;
    expect((await v2.repair(crypto.randomUUID(), 'recovery', binding)).repair).toBe('complete');
    expect(await (await root(v2, 'fresh')).text()).toBe('v2:/');
    expect(
      await (
        await asset(
          v2,
          'fallback',
          g.entries.find((e) => e.url.endsWith('.js') && !e.url.includes('supabase'))!.url,
        )
      ).text(),
    ).toContain('v1:');
  });
  it('corrupted completed staging permits a new deliberate attempt and never resets the old budget', async () => {
    const { f, g, binding } = await repaired();
    await f.damage(g, 'bytes', true);
    expect(await (await root(g, 'still-recovery')).text()).toBe(recoveryHTML);
    expect((await g.repair(crypto.randomUUID(), 'recovery-1', binding)).repair).toBe('complete');
    expect((await g.snapshot()).chain.filter((r) => r.body.kind === 'attempt')).toHaveLength(2);
    expect(await (await root(g, 'adopt')).text()).toBe('v1:/');
  });
  it('a replayed cancellation cannot cancel a subsequent deliberate repair', async () => {
    const { f, g } = await ready();
    const binding = await recovery(f, g);
    f.delayPath = '/assets/supabase-sharedxx.js';
    g.host.repairDeadline = 1000;
    const cancelID = crypto.randomUUID();
    const first = g.repair(crypto.randomUUID(), 'recovery-1', binding);
    while (!f.releaseDelay) await new Promise((r) => setTimeout(r, 1));
    await rpc(g, 'recovery-1', 'CANCEL', cancelID);
    expect((await first).repair).toBe('cancelled');
    f.releaseDelay = undefined;
    const second = g.repair(crypto.randomUUID(), 'recovery-1', binding);
    while (!f.releaseDelay) await new Promise((r) => setTimeout(r, 1));
    await rpc(g, 'recovery-1', 'CANCEL', cancelID);
    expect((await g.status('recovery-1')).repair).toBe('busy');
    (f.releaseDelay as unknown as () => void)();
    expect((await second).repair).toBe('complete');
  });
  it.each(['beforeDelete', 'afterDelete'])(
    'restart %s resumes only the sealed set idempotently',
    async (point) => {
      const { f } = await ready();
      for (const version of ['v2', 'v3']) {
        const g = await f.engine(version);
        await g.install();
        await g.activate();
      }
      const g = await f.engine('v3');
      await g.initialize();
      let interrupted = false;
      f.hook = async (p, name) => {
        if (!interrupted && p === point && name.includes('resource-v3')) {
          interrupted = true;
          throw Error('termination deleting');
        }
      };
      await expect(g.cleanup()).rejects.toThrow();
      f.hook = undefined;
      const restart = await f.engine('v3');
      await restart.initialize();
      await restart.cleanup();
      expect([...f.stores.keys()].filter((n) => n.includes('resource-v3'))).toHaveLength(2);
      expect(await (await root(restart, 'new')).text()).toBe('v3:/');
    },
  );
  it('a deletion seal rejects a later document reference to that exact generation', async () => {
    const { f } = await ready();
    for (const version of ['v2', 'v3']) {
      const g = await f.engine(version);
      await g.install();
      await g.activate();
    }
    const g = await f.engine('v3');
    await g.initialize();
    await g.cleanup();
    const s = await g.snapshot(),
      sealed = [...s.sealed][0];
    expect(sealed).toBeTruthy();
    const body = {
      schema: 3 as const,
      origin,
      compatibility: g.compatibility,
      worker: g.worker,
      epoch: s.epoch,
      parent: s.head!.id,
      sequence: s.chain.length,
      kind: 'navigation' as const,
      navigation: crypto.randomUUID(),
      client: 'forged-late-reference',
      mode: 'shell' as const,
      references: [sealed],
    };
    const id = await digest(canonical(body));
    f.stores
      .get(META)!
      .set(
        metadataURL(origin, id),
        new Response(canonical({ id, body }), { headers: { 'content-type': 'application/json' } }),
      );
    expect(await (await root(g, 'new')).text()).toBe(recoveryHTML);
  });
  it('cleanup source reservations and callback bindings race safely with selection and install', async () => {
    const { f, g } = await ready();
    await root(g, 'callback', '/auth/callback?code=not-persisted');
    const v2 = await f.engine('v2');
    await v2.install();
    await v2.activate();
    const v3 = await f.engine('v3');
    await v3.install();
    await v3.activate();
    await Promise.all([
      v3.cleanup(),
      root(v3, 'new-callback', '/auth/callback?code=not-persisted'),
    ]);
    expect((await v3.snapshot()).sealed.size).toBe(0);
    expect(
      await (
        await asset(
          v3,
          'callback',
          g.entries.find((e) => e.url.endsWith('.js') && !e.url.includes('supabase'))!.url,
        )
      ).text(),
    ).toContain('v1:');
  });
  it('installing/waiting and in-flight repair generations survive another worker cleanup', async () => {
    const { f, g } = await ready();
    const waiting = await f.engine('v2');
    await waiting.install();
    f.busy = true;
    expect(await g.cleanup()).toBe(false);
    const s = await waiting.snapshot();
    const completed = [...s.records].filter(([, r]) => r.kind === 'complete');
    for (const [id] of completed) expect(await waiting.verify(s, id)).toBe(true);
  });
  it.each(['beforePut', 'afterPut'])(
    'restart %s cutover commit preserves old caches and never resets history',
    async (point) => {
      const f = new StaticFixture();
      await legacy(f);
      const oldNames = [...f.stores.keys()];
      const corrected = await f.engine('v2');
      let stop = false;
      f.hook = async (p, name, _key, response) => {
        if (
          !stop &&
          name === META &&
          p === point &&
          response &&
          (JSON.parse(await response.clone().text()) as Stored).body.kind === 'cutover'
        ) {
          stop = true;
          throw Error('cutover interrupted');
        }
      };
      await expect(corrected.install()).rejects.toThrow();
      f.hook = undefined;
      const next = await f.engine('v2');
      await next.install();
      await next.activate();
      expect(await (await root(next, 'new')).text()).toBe('v2:/');
      for (const name of oldNames) expect(f.stores.has(name)).toBe(true);
    },
  );
  it('unsupported newer legacy metadata stops cutover without mutation or network activity', async () => {
    const f = new StaticFixture();
    await legacy(f);
    const old = f.stores.get('spendspacey-static-meta-v2')!;
    const first = [...old.keys()][0];
    const raw = JSON.parse(await old.get(first)!.clone().text());
    old.set(
      first,
      new Response(canonical({ ...raw, body: { ...raw.body, schema: 99 } }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    const count = f.fetches.length;
    const g = await f.engine('v2');
    await expect(g.install()).rejects.toThrow();
    expect(f.fetches.length).toBe(count);
    expect(f.stores.has(META)).toBe(false);
  });
  it('unknown/interrupted legacy repair history is persisted rather than converted into a new attempt', async () => {
    const f = new StaticFixture();
    const old = await legacy(f);
    const request = crypto.randomUUID();
    await old.repair(request, false);
    const meta = f.stores.get('spendspacey-static-meta-v2')!;
    for (const [key, r] of meta)
      if ((await r.clone().json()).body.kind === 'finish') meta.delete(key);
    const next = await f.engine('v2');
    await next.install();
    await next.activate();
    const cut = [...(await next.snapshot()).records.values()].find((r) => r.kind === 'cutover');
    expect(
      cut?.kind === 'cutover' &&
        cut.attempts.some((a) => a.request === request && a.outcome === 'unknown'),
    ).toBe(true);
    expect((await next.status()).repair).toBe('unknown');
  });
});

it('merges legacy attempts created while the corrected worker was waiting before allowing corrected repair', async () => {
  const f = new StaticFixture();
  const old = await legacy(f);
  const corrected = await f.engine('v2');
  await corrected.install();
  const spent = crypto.randomUUID();
  await old.repair(spent, false);
  await corrected.activate();
  const history = [...(await corrected.snapshot()).records.values()].find(
    (r) => r.kind === 'legacy-update',
  );
  expect(
    history?.kind === 'legacy-update' && history.attempts.some((a) => a.request === spent),
  ).toBe(true);
  const binding = await recovery(f, corrected);
  const count = f.fetches.length;
  await corrected.repair(spent, 'recovery-1', binding);
  expect(f.fetches.length).toBe(count);
});

it('keeps a verified imported rollback but uses independent recovery for the obsolete v2 control protocol', async () => {
  const f = new StaticFixture();
  await legacy(f);
  const corrected = await f.engine('v2');
  await corrected.install();
  await f.damage(corrected, 'missing', true);
  await corrected.activate();
  const s = await corrected.snapshot();
  const chosen = (await selected(corrected)).selected;
  expect(await corrected.verify(s, chosen)).toBe(true);
  expect(await (await root(corrected, 'upgrade-recovery')).text()).toBe(recoveryHTML);
  const callback = await root(corrected, 'upgrade-callback', '/auth/callback');
  expect(await callback.text()).toBe('old:/');
  const binding = (await corrected.status('upgrade-recovery')).binding!;
  const before = f.fetches.length;
  expect((await corrected.repair(crypto.randomUUID(), 'upgrade-recovery', binding)).repair).toBe(
    'complete',
  );
  expect(
    f.fetches.slice(before).every((r) => corrected.entries.some((e) => r.url === origin + e.url)),
  ).toBe(true);
  expect(await (await root(corrected, 'upgraded')).text()).toBe('v2:/');
});

it('restores deterministic selection and pending repair from committed lineage with reversed cache enumeration', async () => {
  const { f, g } = await repaired();
  const expected = (await g.status('recovery-1')).binding;
  f.stores.set(META, new Map([...f.stores.get(META)!].reverse()));
  const restarted = await f.engine('v1');
  await restarted.initialize();
  expect((await restarted.status('recovery-1')).binding).toBe(expected);
  expect(await (await root(restarted, 'fresh')).text()).toBe('v1:/');
  expect((await restarted.status('fresh')).ready).toBe(true);
});
