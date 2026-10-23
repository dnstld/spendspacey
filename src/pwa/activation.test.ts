import { describe, it, expect } from 'vitest';
import { StaticFixture, navigation, origin } from '../../test/staticGenerations';
import { Generations } from '../../worker/generations';
import { isBrowserActive } from '../../worker/authority';
import { META, canonical, digest, metadataURL, type Stored } from '../../worker/schema';
import { recoveryHTML, resourceRecoveryHTML } from '../../worker/recovery';

async function replacement() {
  const f = new StaticFixture();
  const old = await f.engine('v1');
  await old.install();
  await old.activate();
  await old.respond(navigation(), 'original');
  const binding = (await old.status('original')).binding;
  const candidate = await f.engine('v2');
  await candidate.install();
  return { f, old, candidate, binding };
}
async function activations(g: Generations) {
  return (await g.snapshot()).chain.filter((r) => r.body.kind === 'activate');
}

describe('restart-resumable browser-active ownership', () => {
  it('native object identity rejects matching URLs/builds, absent, waiting and redundant workers', () => {
    const active = { scriptURL: '/sw.js', state: 'activated' };
    const check = (running: unknown, registered: unknown) =>
      isBrowserActive({
        serviceWorker: running,
        registration: { active: registered },
      } as Parameters<typeof isBrowserActive>[0]);
    expect(check(active, active)).toBe(true);
    expect(check({ ...active }, active)).toBe(false);
    expect(check(null, active)).toBe(false);
    for (const state of ['installed', 'installing', 'redundant']) {
      const worker = { ...active, state };
      expect(check(worker, worker)).toBe(false);
    }
    const activating = { ...active, state: 'activating' };
    expect(check(activating, activating)).toBe(true);
  });
  for (const restart of [false, true])
    it.each(['beforePut', 'afterPut', 'readback', 'afterCommit'])(
      `resumes %s with restart=${restart}, preserving predecessor and pins`,
      async (point) => {
        const { f, old, candidate, binding } = await replacement();
        let written = false;
        f.hook = async (p, name, _key, response) => {
          if (name !== META) return;
          if (
            response &&
            (JSON.parse(await response.clone().text()) as Stored).body.kind === 'activate'
          ) {
            if (point === p) throw Error('termination');
            if (p === 'afterPut') written = true;
          }
          if (written && p === 'match' && point === 'readback')
            throw Error('read-back interrupted');
        };
        const snapshot = candidate.snapshot.bind(candidate);
        candidate.snapshot = async (...args) => {
          const restored = await snapshot(...args);
          if (point === 'afterCommit' && !args[0] && restored.owner === candidate.worker)
            throw Error('validated commit interrupted before local epoch restoration');
          return restored;
        };
        await expect(candidate.activate()).rejects.toThrow();
        f.hook = undefined;
        candidate.snapshot = snapshot;
        const g = restart ? await f.engine('v2') : candidate;
        const requests = f.fetches.length;
        expect(await g.reconcile()).toBe(true);
        expect(await (await g.respond(navigation(), 'cold-first'))!.text()).toBe('v2:/');
        expect((await g.status('original')).binding).toBe(binding);
        expect(
          await (await g.respond(
            new Request(origin + old.entries.find((e) => e.url.includes('index-v1'))!.url),
            '',
            'original',
          ))!.text(),
        ).toContain('v1:');
        expect(await activations(g)).toHaveLength(2);
        const head = (await g.snapshot()).head?.id;
        expect(await Promise.all(Array.from({ length: 8 }, () => g.reconcile()))).toEqual(
          Array(8).fill(true),
        );
        await Promise.all([g.status('original'), g.cleanup(), g.reconcile()]);
        expect((await g.snapshot()).head?.id).toBe(head);
        expect(f.fetches).toHaveLength(requests);
      },
    );
  it('persistent rejection stays bounded and exposes intact prepared resources without inventing a binding', async () => {
    const { f, candidate } = await replacement();
    f.failKind = 'activate';
    for (let n = 0; n < 3; n++) {
      expect(await candidate.reconcile()).toBe(false);
      expect(await (await candidate.respond(navigation(), 'unbound-' + n))!.text()).toBe(
        recoveryHTML,
      );
      const status = await candidate.status('unbound-' + n);
      expect(status).toMatchObject({
        authority: 'none',
        binding: null,
        prepared: true,
        ready: false,
      });
    }
    expect(await activations(candidate)).toHaveLength(1);
    expect(
      (await candidate.snapshot()).chain.some(
        (r) => r.body.kind === 'attempt' || r.body.kind === 'seal',
      ),
    ).toBe(false);
    f.failKind = '';
    const fixed = await f.engine('v2');
    expect(await fixed.reconcile()).toBe(true);
    expect((await fixed.status('unbound-0')).binding).toBeNull();
    expect(await (await fixed.respond(navigation(), 'later-authorized-navigation'))!.text()).toBe(
      'v2:/',
    );
  });
  it('rejects waiting/stale authority, including loss immediately before persistence', async () => {
    const { f, old, candidate } = await replacement();
    candidate.host.active = () => false;
    expect(await candidate.reconcile()).toBe(false);
    candidate.host.active = () => true;
    // The actual pre-put native check is before Cache.put; emulate loss during verification instead.
    f.hook = async (p, name) => {
      if (p === 'match' && name.startsWith('spendspacey-static-resource-v3-'))
        candidate.host.active = () => false;
    };
    expect(await candidate.reconcile()).toBe(false);
    f.hook = undefined;
    candidate.host.active = () => true;
    expect(await candidate.reconcile()).toBe(true);
    old.host.active = () => false;
    expect(await old.reconcile()).toBe(false);
  });
  it('rejects ambiguous, superseded and obsolete same-build reservations', async () => {
    const { f, candidate } = await replacement();
    const repeated = await f.engine('v2');
    await repeated.install();
    expect(await candidate.reconcile()).toBe(false);
    const newest = await f.engine('v3');
    await newest.install();
    expect(await newest.reconcile()).toBe(true);
    expect(await repeated.reconcile()).toBe(false);
    const same = await f.engine('v3');
    await same.install();
    expect(await same.reconcile()).toBe(false);
    const freshRollback = await f.engine('v1');
    await freshRollback.install();
    expect(await freshRollback.reconcile()).toBe(true);
    expect(await (await freshRollback.respond(navigation(), 'rollback'))!.text()).toBe('v1:/');
  });
  it('superseded candidates cannot claim even before the successor activates', async () => {
    const { f, candidate } = await replacement();
    const successor = await f.engine('v3');
    await successor.install();
    expect(await candidate.reconcile()).toBe(false);
    expect(await successor.reconcile()).toBe(true);
  });
  it('different workers with identical application assets remain distinct', async () => {
    const f = new StaticFixture();
    const old = await f.engine('v1');
    await old.install();
    await old.activate();
    const source = f.inventories.get('v1')!;
    const implementation = await digest('different-worker');
    const entries = source.map(({ url, key, revision, integrity, type, bytes }) => ({
      url,
      key,
      revision,
      integrity,
      type,
      bytes,
    }));
    const worker = await digest(
      canonical({
        entries,
        compatibility: source[0].compatibility,
        legacyCompatibility: source[0].legacyCompatibility,
        implementation,
      }),
    );
    const g = new Generations(
      f.host(),
      source.map((e) => ({ ...e, implementation, worker })),
    );
    await g.install();
    expect(await g.reconcile()).toBe(true);
    expect((await g.snapshot()).owner).toBe(worker);
    expect(await activations(g)).toHaveLength(2);
  });
  it.each(['corrupt', 'fork', 'incompatible', 'unsupported'])(
    `rejects %s lineage without mutation or cleanup`,
    async (kind) => {
      const { f, candidate } = await replacement();
      const rows = f.stores.get(META)!;
      const last = (await f.records()).at(-1)!;
      if (kind === 'corrupt')
        rows.set(
          metadataURL(origin, last.id),
          new Response('{}', { headers: { 'content-type': 'application/json' } }),
        );
      if (kind === 'fork') {
        const body = { ...last.body, worker: 'f'.repeat(64) };
        const id = await digest(canonical(body));
        rows.set(
          metadataURL(origin, id),
          new Response(canonical({ id, body }), {
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (kind === 'incompatible')
        await f.mutate(last, { ...last.body, compatibility: 'f'.repeat(64) });
      if (kind === 'unsupported') f.stores.set('spendspacey-static-ownership-v4', new Map());
      const counts = [...f.stores].map(([key, value]) => [key, value.size]);
      const fetches = f.fetches.length;
      expect(await candidate.reconcile()).toBe(false);
      expect([...f.stores].map(([key, value]) => [key, value.size])).toEqual(counts);
      expect(f.fetches).toHaveLength(fetches);
    },
  );
  it('does not reset spent repair history or later adoption on repeated reconciliation', async () => {
    const { f, old, candidate } = await replacement();
    await candidate.activate();
    await f.damage(candidate, 'missing', false, '/assets/supabase-sharedxx.js');
    await f.damage(old, 'missing', true, '/assets/supabase-sharedxx.js');
    await candidate.respond(navigation(), 'recovery');
    const binding = (await candidate.status('recovery')).binding!;
    await candidate.repair(crypto.randomUUID(), 'recovery', binding);
    await candidate.respond(navigation(), 'adopted');
    const head = (await candidate.snapshot()).head!.id;
    const restart = await f.engine('v2');
    expect(await restart.reconcile()).toBe(true);
    expect((await restart.snapshot()).head!.id).toBe(head);
    expect((await restart.status('adopted')).ready).toBe(true);
    expect((await restart.snapshot()).chain.filter((r) => r.body.kind === 'attempt')).toHaveLength(
      1,
    );
    expect(await (await restart.respond(navigation(), ''))!.text()).toBe(recoveryHTML);
    expect(await (await restart.respond(navigation(), 'adopted'))!.text()).toBe(recoveryHTML);
    expect((await restart.snapshot()).head!.id).toBe(head);
  });
});

it('only verified missing/corrupt resources receive resource-loss diagnostics', async () => {
  const f = new StaticFixture();
  const g = await f.engine('v1');
  await g.install();
  await g.activate();
  expect(await (await g.respond(navigation(), ''))!.text()).toBe(recoveryHTML);
  await f.damage(g, 'bytes', false, '/');
  expect(await (await g.respond(navigation(), 'lost'))!.text()).toBe(resourceRecoveryHTML);
  expect((await g.status('lost')).authority).toBe('recovery');
});

it('simultaneous functional reconciliation, navigation, status and cleanup commit one transfer', async () => {
  const { f, candidate, binding } = await replacement();
  f.failKind = 'activate';
  await candidate.reconcile();
  f.failKind = '';
  const results = await Promise.all(
    ['a', 'b', 'c']
      .map(async (id) => {
        expect(await candidate.reconcile()).toBe(true);
        return (await candidate.respond(navigation(), id))!.text();
      })
      .concat([
        (async () => {
          expect(await candidate.reconcile()).toBe(true);
          await candidate.status('original');
          return 'status';
        })(),
        (async () => {
          expect(await candidate.reconcile()).toBe(true);
          await candidate.cleanup();
          return 'cleanup';
        })(),
      ]),
  );
  expect(results.slice(0, 3)).toEqual(['v2:/', 'v2:/', 'v2:/']);
  expect(await activations(candidate)).toHaveLength(2);
  expect((await candidate.status('original')).binding).toBe(binding);
});
it('a reservation without completion cannot be reused as an active installation', async () => {
  const { f, candidate } = await replacement();
  const last = (await f.records()).at(-1)!;
  expect(last.body.kind).toBe('complete');
  f.stores.get(META)!.delete(metadataURL(origin, last.id));
  expect(await candidate.reconcile()).toBe(false);
  expect(await activations(candidate)).toHaveLength(1);
});

it('a same-build stale instance cannot borrow committed ownership for a document write', async () => {
  const f = new StaticFixture();
  const active = await f.engine('v1');
  await active.install();
  await active.activate();
  const stale = await f.engine('v1');
  stale.host.active = () => false;
  const head = (await active.snapshot()).head!.id;
  expect(await (await stale.respond(navigation(), 'borrowed'))!.text()).toBe(recoveryHTML);
  expect((await stale.status('borrowed')).binding).toBeNull();
  expect((await active.snapshot()).head!.id).toBe(head);
});
