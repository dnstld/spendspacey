import { describe, it, expect, vi } from 'vitest';
import { StaticFixture, navigation, origin } from '../../test/staticGenerations';
import { Generations } from '../../worker/generations';
import { isBrowserActive } from '../../worker/authority';
import { META, LOCK, canonical, digest, metadataURL, type Stored } from '../../worker/schema';
import { barrier, RepairDeadline } from '../../test/repairOutcomes';
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
        registration: { active: registered, scope: origin + '/' },
        location: { origin },
      } as Parameters<typeof isBrowserActive>[0]);
    expect(check(active, active)).toBe(true);
    for (const scope of [origin + '/other/', 'https://elsewhere.test/', ''])
      expect(
        isBrowserActive({
          serviceWorker: active,
          registration: { active, scope },
          location: { origin },
        } as unknown as Parameters<typeof isBrowserActive>[0]),
      ).toBe(false);
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
        prepared: false,
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
  it('rejects ambiguous and superseded different-owner transfers while restoring committed owners', async () => {
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
    expect(await same.reconcile()).toBe(true);
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

// Separate candidate cardinality from supersession, using the real reconciliation
// path under its writer lock. This trace observes errors; it never changes them.
function traceActivation(g: Generations) {
  const errors: string[] = [];
  const instance = g as unknown as { restoreActivation(authority: () => boolean): Promise<void> };
  const original = instance.restoreActivation.bind(g);
  vi.spyOn(instance, 'restoreActivation').mockImplementation(async (authority) => {
    try {
      await original(authority);
    } catch (error) {
      errors.push((error as Error).message);
      throw error;
    }
  });
  return errors;
}
async function candidateFixture() {
  const f = new StaticFixture(),
    host = f.host.bind(f);
  // Ordering tests explicitly fire deadlines, independent of elapsed CPU time.
  f.host = () => ({
    ...host(),
    scheduleValidationDeadline: () => () => {},
    scheduleRepairDeadline: () => () => {},
  });
  const old = await f.engine('v1');
  await old.install();
  await old.activate();
  expect(await (await old.respond(navigation(), 'pinned-predecessor'))!.text()).toBe('v1:/');
  return { f, old };
}
async function incomplete(f: StaticFixture, version = 'v2', fullBytes = false) {
  const g = await f.engine(version);
  if (fullBytes) f.failKind = 'complete';
  else f.failPath = g.entries.find((e) => e.url.endsWith('.css'))!.url;
  await expect(g.install()).rejects.toThrow();
  f.failKind = '';
  f.failPath = '';
  return g;
}
async function candidatePair(g: Generations) {
  const s = await g.snapshot();
  const completion = s.chain
    .filter(
      (r) => r.body.kind === 'complete' && s.records.get(r.body.reservation)?.worker === g.worker,
    )
    .at(-1)!;
  if (completion.body.kind !== 'complete') throw Error('Missing fixture completion');
  return { completion: completion.id, installation: completion.body.reservation };
}
async function assertBlocked(f: StaticFixture, g: Generations, reason: string) {
  const before = await g.snapshot(),
    names = [...f.stores.keys()].sort(),
    requests = f.fetches.length;
  const errors = traceActivation(g);
  expect(await g.reconcile()).toBe(false);
  expect(errors).toContain(reason);
  expect(await (await g.respond(navigation(), 'must-stay-unbound'))!.text()).toBe(recoveryHTML);
  expect((await g.status('must-stay-unbound', false)).binding).toBeNull();
  expect(await g.snapshot()).toEqual(before);
  expect(await g.cleanup()).toBe(false);
  expect([...f.stores.keys()].sort()).toEqual(names);
  expect(f.fetches).toHaveLength(requests);
}
async function assertAdopted(f: StaticFixture, old: Generations, g: Generations) {
  const before = await old.snapshot(),
    pair = await candidatePair(g),
    requests = f.fetches.length;
  const errors = traceActivation(g);
  expect(await g.reconcile()).toBe(true);
  expect(errors).toEqual([]);
  const committed = await g.snapshot();
  expect(committed.chain.slice(0, before.chain.length)).toEqual(before.chain);
  const activation = committed.chain.filter((r) => r.body.kind === 'activate').at(-1)!;
  expect(activation.body).toMatchObject({
    kind: 'activate',
    installation: pair.installation,
    selected: pair.completion,
  });
  expect(committed.epoch).not.toBe(before.epoch);
  expect(committed.bindings).toEqual(before.bindings);
  expect(await (await g.respond(navigation(), 'adopted'))!.text()).toBe('v2:/');
  expect(await g.status('adopted')).toMatchObject({
    authority: 'application',
    ready: true,
    generation: pair.completion,
  });
  const epoch = (await g.snapshot()).epoch,
    head = (await g.snapshot()).head;
  expect(await Promise.all(Array.from({ length: 6 }, () => g.reconcile()))).toEqual(
    Array(6).fill(true),
  );
  expect((await g.snapshot()).head).toEqual(head);
  f.online = false;
  const restarted = await f.engine('v2');
  expect(await restarted.reconcile()).toBe(true);
  expect(await (await restarted.respond(navigation(), 'offline-cold'))!.text()).toBe('v2:/');
  expect(await restarted.status('offline-cold')).toMatchObject({
    ready: true,
    generation: pair.completion,
    epoch,
  });
  expect((await restarted.snapshot()).chain.filter((r) => r.body.kind === 'activate')).toHaveLength(
    2,
  );
  expect(f.fetches).toHaveLength(requests);
  f.online = true;
}
async function rawRecord(f: StaticFixture, body: Stored['body']) {
  const id = await digest(canonical(body));
  f.stores
    .get(META)!
    .set(
      metadataURL(origin, id),
      new Response(canonical({ id, body }), { headers: { 'content-type': 'application/json' } }),
    );
  return id;
}

describe('completion-first candidates and independent supersession', () => {
  it.each([1, 3])(
    'adopts one completed latest candidate after %s incomplete installs, preserving every reservation',
    async (count) => {
      const { f, old } = await candidateFixture();
      for (let n = 0; n < count; n++) await incomplete(f);
      const g = await f.engine('v2');
      await g.install();
      const before = await g.snapshot();
      const resources = [...f.stores.keys()].sort();
      await assertAdopted(f, old, g);
      expect(await g.cleanup()).toBe(false);
      expect([...f.stores.keys()].sort()).toEqual(resources);
      expect((await g.snapshot()).chain.filter((r) => r.body.kind === 'reserve')).toEqual(
        before.chain.filter((r) => r.body.kind === 'reserve'),
      );
    },
  );
  it.each([false, true])(
    'zero completions never qualifies, even with full cached bytes=%s',
    async (full) => {
      const { f } = await candidateFixture();
      const g = await incomplete(f, 'v2', full);
      await assertBlocked(f, g, 'No unique fenced installation');
    },
  );
  it.each(['v2', 'v3'])(
    'a later incomplete %s reservation independently supersedes the older completion',
    async (version) => {
      const { f } = await candidateFixture();
      const g = await f.engine('v2');
      await g.install();
      await incomplete(f, version);
      await assertBlocked(f, g, 'Superseded installation');
    },
  );
  it('late completion arrival cannot override reservation order', async () => {
    const { f } = await candidateFixture();
    const a = await incomplete(f, 'v2', true);
    const s = await a.snapshot();
    const r1 = s.chain
      .filter((r) => r.body.kind === 'reserve' && r.body.worker === a.worker)
      .at(-1)!;
    await incomplete(f);
    const now = await a.snapshot();
    await rawRecord(f, {
      schema: 3,
      origin,
      compatibility: a.compatibility,
      worker: a.worker,
      epoch: now.epoch,
      parent: now.head!.id,
      sequence: now.chain.length,
      kind: 'complete',
      reservation: r1.id,
    });
    await assertBlocked(f, a, 'Superseded installation');
  });
  it.each([false, true])(
    'multiple durable completions stay ambiguous with one damaged cache=%s',
    async (damage) => {
      const { f } = await candidateFixture();
      const a = await f.engine('v2');
      await a.install();
      const first = await candidatePair(a);
      const b = await f.engine('v2');
      await b.install();
      if (damage) {
        const s = await b.snapshot(),
          r = s.records.get(first.installation);
        if (r?.kind !== 'reserve') throw Error();
        f.stores.get('spendspacey-static-resource-v3-' + r.instance)!.delete(origin + '/');
      }
      await assertBlocked(f, b, 'No unique fenced installation');
    },
  );
  it.each(['beforePut', 'afterPut', 'readback', 'lineage'])(
    'completion %s failure uses durable facts rather than the rejected caller result',
    async (point) => {
      const { f, old } = await candidateFixture();
      const a = await f.engine('v2');
      let written = false,
        key = '',
        fired = false;
      f.hook = async (p, name, url, response) => {
        if (name !== META || fired) return;
        if (
          response &&
          (JSON.parse(await response.clone().text()) as Stored).body.kind === 'complete'
        ) {
          key = url;
          if (p === 'afterPut') written = true;
          if (p === point) {
            fired = true;
            throw Error('completion caller interrupted');
          }
        }
        if (point === 'readback' && written && p === 'match' && url === key) {
          fired = true;
          throw Error('unacknowledged readback');
        }
      };
      const snapshot = a.snapshot.bind(a);
      a.snapshot = async (extra) => {
        const s = await snapshot(extra);
        if (
          point === 'lineage' &&
          written &&
          !extra &&
          !fired &&
          s.head?.body.kind === 'complete'
        ) {
          fired = true;
          throw Error('completion lineage acknowledgment lost');
        }
        return s;
      };
      await expect(a.install()).rejects.toThrow();
      expect(fired).toBe(true);
      f.hook = undefined;
      a.snapshot = snapshot;
      const b = await f.engine('v2');
      await b.install();
      const completions = (await b.snapshot()).chain.filter(
        (r) => r.body.kind === 'complete' && r.body.worker === b.worker,
      );
      expect(completions).toHaveLength(point === 'beforePut' ? 1 : 2);
      if (point === 'beforePut') await assertAdopted(f, old, b);
      else await assertBlocked(f, b, 'No unique fenced installation');
    },
  );
  it('a hanging completion retains the writer lock until late settlement, without publication or replay', async () => {
    const { f } = await candidateFixture();
    const a = await f.engine('v2');
    const entered = barrier(),
      release = barrier();
    let held = false;
    f.hook = async (p, name, _key, response) => {
      if (
        held ||
        p !== 'afterPut' ||
        name !== META ||
        !response ||
        (JSON.parse(await response.clone().text()) as Stored).body.kind !== 'complete'
      )
        return;
      held = true;
      entered.resolve();
      await release.promise;
      throw Error('late unacknowledged completion');
    };
    const installing = a.install();
    const failed = expect(installing).rejects.toThrow();
    await entered.promise;
    expect(
      await f.locks.request(LOCK, { mode: 'exclusive', ifAvailable: true }, (lock) => !!lock),
    ).toBe(false);
    const b = await f.engine('v2');
    const retry = b.install();
    expect((await a.snapshot()).chain.filter((r) => r.body.kind === 'activate')).toHaveLength(1);
    release.resolve();
    await failed;
    f.hook = undefined;
    await retry;
    expect(
      (await b.snapshot()).chain.filter(
        (r) => r.body.kind === 'complete' && r.body.worker === b.worker,
      ),
    ).toHaveLength(2);
    await assertBlocked(f, b, 'No unique fenced installation');
  });
  it.each(['malformed', 'fork', 'unsupported', 'incompatible', 'parent', 'duplicate-completion'])(
    'validating the entire lineage rejects unrelated %s records before filtering',
    async (kind) => {
      const { f } = await candidateFixture();
      await incomplete(f);
      const g = await f.engine('v2');
      await g.install();
      const s = await g.snapshot();
      if (kind === 'unsupported') f.stores.set('spendspacey-static-ownership-v999', new Map());
      else if (kind === 'malformed')
        f.stores
          .get(META)!
          .set(
            metadataURL(origin, 'f'.repeat(64)),
            new Response('{}', { headers: { 'content-type': 'application/json' } }),
          );
      else if (kind === 'duplicate-completion') {
        const c = s.chain
          .filter((r) => r.body.kind === 'complete' && r.body.worker === g.worker)
          .at(-1)!;
        await rawRecord(f, { ...c.body, parent: s.head!.id, sequence: s.chain.length });
      } else {
        const first = s.chain[0];
        if (first.body.kind !== 'reserve') throw Error();
        await rawRecord(f, {
          ...first.body,
          instance: crypto.randomUUID(),
          ...(kind === 'incompatible' ? { compatibility: 'f'.repeat(64) } : {}),
          ...(kind === 'parent' ? { parent: 'f'.repeat(64), sequence: s.chain.length } : {}),
        });
      }
      const before = [...f.stores].map(([name, rows]) => [name, [...rows.keys()]]);
      expect(await g.reconcile()).toBe(false);
      expect((await g.status('', false)).repair).toBe('blocked');
      expect(await g.cleanup()).toBe(false);
      expect([...f.stores].map(([name, rows]) => [name, [...rows.keys()]])).toEqual(before);
    },
  );
  it('stale-epoch completed reservations cannot authorize transfer after a successor commits', async () => {
    const { f } = await candidateFixture();
    await incomplete(f);
    const g = await f.engine('v2');
    await g.install();
    const successor = await f.engine('v3');
    await successor.install();
    await successor.activate();
    await assertBlocked(f, g, 'No unique fenced installation');
  });
  it('authority loss during resource verification is distinct from uniqueness and supersession', async () => {
    const { f } = await candidateFixture();
    await incomplete(f);
    const g = await f.engine('v2');
    await g.install();
    f.hook = async (p, name) => {
      if (p === 'match' && name.includes('resource-v3')) g.host.active = () => false;
    };
    await assertBlocked(f, g, 'Browser-active authority lost');
  });
  it('head changes after candidate selection are fenced before activation persistence', async () => {
    const { f } = await candidateFixture();
    await incomplete(f);
    const g = await f.engine('v2');
    await g.install();
    const before = await g.snapshot();
    const reserve = before.records.get((await candidatePair(g)).installation);
    if (reserve?.kind !== 'reserve') throw Error();
    let inserted = '';
    let inserting = false;
    f.hook = async (p, name) => {
      if (inserting || p !== 'match' || !name.includes('resource-v3')) return;
      inserting = true;
      inserted = await rawRecord(f, {
        ...reserve,
        instance: crypto.randomUUID(),
        parent: before.head!.id,
        sequence: before.chain.length,
      });
    };
    const errors = traceActivation(g);
    expect(await g.reconcile()).toBe(false);
    expect(errors).toContain('Head changed');
    const after = await g.snapshot();
    expect(after.head?.id).toBe(inserted);
    expect(after.epoch).toBe(before.epoch);
    expect(after.chain.filter((r) => r.body.kind === 'activate')).toHaveLength(1);
  });
  it('a parent fork during uncertain activation persistence cannot become accepted ownership', async () => {
    const { f } = await candidateFixture();
    await incomplete(f);
    const g = await f.engine('v2');
    await g.install();
    const before = await g.snapshot();
    const reserve = before.records.get((await candidatePair(g)).installation);
    if (reserve?.kind !== 'reserve') throw Error();
    let changed = false;
    f.hook = async (p, name, _key, response) => {
      if (
        changed ||
        p !== 'beforePut' ||
        name !== META ||
        !response ||
        (JSON.parse(await response.clone().text()) as Stored).body.kind !== 'activate'
      )
        return;
      changed = true;
      await rawRecord(f, {
        ...reserve,
        instance: crypto.randomUUID(),
        parent: before.head!.id,
        sequence: before.chain.length,
      });
    };
    expect(await g.reconcile()).toBe(false);
    expect(changed).toBe(true);
    expect((await g.status('', false)).repair).toBe('blocked');
    expect(await g.cleanup()).toBe(false);
  });
  it('concurrent navigation/status/cleanup coalesces one activation and commits binding before bytes', async () => {
    const { f } = await candidateFixture();
    await incomplete(f);
    const g = await f.engine('v2');
    await g.install();
    const entered = barrier(),
      release = barrier();
    let held = false;
    f.hook = async (p, name, _key, response) => {
      if (
        held ||
        p !== 'beforePut' ||
        name !== META ||
        !response ||
        (JSON.parse(await response.clone().text()) as Stored).body.kind !== 'activate'
      )
        return;
      held = true;
      entered.resolve();
      await release.promise;
    };
    const reconciling = g.reconcile();
    await entered.promise;
    const navigating = g.respond(navigation(), 'joint-bound');
    const status = g.status('joint-bound');
    const cleaning = g.cleanup();
    expect(
      await f.locks.request(LOCK, { mode: 'exclusive', ifAvailable: true }, (lock) => !!lock),
    ).toBe(false);
    release.resolve();
    expect(await reconciling).toBe(true);
    const response = await navigating;
    expect(await response!.text()).toBe('v2:/');
    await status;
    await cleaning;
    f.hook = undefined;
    expect(await g.status('joint-bound')).toMatchObject({ authority: 'application', ready: true });
    const s = await g.snapshot();
    expect(s.bindings.get('joint-bound')?.body.kind).toBe('deliver');
    expect(s.chain.filter((r) => r.body.kind === 'activate')).toHaveLength(2);
    expect(s.chain.some((r) => r.body.kind === 'attempt' || r.body.kind === 'seal')).toBe(false);
  });
  it('a caller deadline cannot release a pending activation writer or duplicate its late commit', async () => {
    const { f } = await candidateFixture();
    await incomplete(f);
    const g = await f.engine('v2');
    await g.install();
    const deadline = new RepairDeadline();
    g.host.scheduleValidationDeadline = deadline.schedule;
    const entered = barrier(),
      release = barrier();
    let held = false;
    let settlement: Promise<unknown> | undefined;
    const locks = g.host.locks!;
    g.host.locks = new Proxy(locks, {
      get(target, key) {
        if (key !== 'request') return Reflect.get(target, key);
        return (...args: unknown[]) => {
          const p = Reflect.apply(target.request, target, args) as Promise<unknown>;
          settlement ??= p.then(
            () => {},
            () => {},
          );
          return p;
        };
      },
    });
    f.hook = async (p, name, _key, response) => {
      if (
        held ||
        p !== 'afterPut' ||
        name !== META ||
        !response ||
        (JSON.parse(await response.clone().text()) as Stored).body.kind !== 'activate'
      )
        return;
      held = true;
      entered.resolve();
      await release.promise;
    };
    const reconciling = g.reconcile();
    await entered.promise;
    deadline.fire();
    expect(await reconciling).toBe(false);
    expect(
      await f.locks.request(LOCK, { mode: 'exclusive', ifAvailable: true }, (lock) => !!lock),
    ).toBe(false);
    expect(await (await g.respond(navigation(), 'expired-unbound'))!.text()).toBe(recoveryHTML);
    release.resolve();
    await settlement;
    await new Promise<void>((resolve) => setImmediate(resolve));
    f.hook = undefined;
    expect(await g.reconcile()).toBe(true);
    expect((await g.snapshot()).chain.filter((r) => r.body.kind === 'activate')).toHaveLength(2);
    expect((await g.status('expired-unbound')).binding).toBeNull();
    expect(await (await g.respond(navigation(), 'later'))!.text()).toBe('v2:/');
  });
  it('transfer after a retry preserves repair outcomes, adopted selection history, pins and deletion seals', async () => {
    const f = new StaticFixture(),
      host = f.host.bind(f);
    f.host = () => ({
      ...host(),
      scheduleValidationDeadline: () => () => {},
      scheduleRepairDeadline: () => () => {},
    });
    for (const version of ['v0', 'v1', 'v2']) {
      const g = await f.engine(version);
      await g.install();
      await g.activate();
    }
    const old = await f.engine('v2');
    await old.reconcile();
    expect(await old.cleanup()).toBe(true);
    await old.respond(navigation(), 'old-pinned');
    await f.damage(old, 'missing', false, '/assets/supabase-sharedxx.js');
    const fallback = await f.engine('v1');
    await fallback.initialize();
    await f.damage(fallback, 'missing', true, '/assets/supabase-sharedxx.js');
    await f.engine('v2'); // Restore the current synthetic network build for deliberate repair.
    await old.respond(navigation(), 'repair-document');
    const binding = (await old.status('repair-document')).binding!;
    expect((await old.repair(crypto.randomUUID(), 'repair-document', binding)).repair).toBe(
      'complete',
    );
    await old.respond(navigation(), 'repaired-adopted');
    await incomplete(f, 'v3');
    const g = await f.engine('v3');
    await g.install();
    const before = await old.snapshot(),
      names = [...f.stores.keys()].sort();
    expect(before.chain.some((r) => r.body.kind === 'finish')).toBe(true);
    expect(before.chain.some((r) => r.body.kind === 'seal')).toBe(true);
    expect(await g.reconcile()).toBe(true);
    const after = await g.snapshot();
    expect(after.chain.slice(0, before.chain.length)).toEqual(before.chain);
    expect(after.bindings).toEqual(before.bindings);
    expect(after.sealed).toEqual(before.sealed);
    expect(await g.cleanup()).toBe(false);
    expect([...f.stores.keys()].sort()).toEqual(names);
  });
});
