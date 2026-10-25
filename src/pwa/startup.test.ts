import { describe, it, expect } from 'vitest';
import { StaticFixture, navigation, origin } from '../../test/staticGenerations';
import { Generations } from '../../worker/generations';
import { META, canonical, digest, metadataURL, type Stored } from '../../worker/schema';
import { recoveryHTML } from '../../worker/recovery';
import { barrier, RepairDeadline } from '../../test/repairOutcomes';

async function retained() {
  const f = new StaticFixture();
  const host = f.host.bind(f);
  // Deterministic matrices fire deadlines explicitly; CPU scheduling is not an outcome.
  f.host = () => ({
    ...host(),
    scheduleValidationDeadline: () => () => {},
    scheduleRepairDeadline: () => () => {},
  });
  const owner = await f.engine('v1');
  await owner.install();
  await owner.activate();
  expect(await (await owner.respond(navigation(), 'retained-document'))!.text()).toBe('v1:/');
  return { f, owner };
}
function failReads(f: StaticFixture, failures: number) {
  let reads = 0;
  f.hook = async (point, name) => {
    if (point === 'match' && name === META) {
      reads++;
      if (failures-- > 0) throw new DOMException('synthetic access denial', 'UnknownError');
    }
  };
  return () => reads;
}
async function app(g: Generations, id: string) {
  expect(await g.reconcile()).toBe(true);
  expect(await (await g.respond(navigation(), id))!.text()).toBe('v1:/');
  expect(await g.status(id)).toMatchObject({ authority: 'application', ready: true });
}

describe('retryable startup and committed-owner restoration', () => {
  it.each([false, true])(
    'one transient read recovers completely with restart=%s',
    async (restart) => {
      const { f, owner } = await retained();
      const before = await owner.snapshot();
      const g = await f.engine('v1');
      failReads(f, 1);
      await g.initialize();
      expect((await g.status('', false)).repair).toBe('unavailable');
      const live = restart ? await f.engine('v1') : g;
      await app(live, 'fresh');
      const after = await live.snapshot();
      expect(after.epoch).toBe(before.epoch);
      expect(after.chain.filter((r) => r.body.kind === 'activate')).toEqual(
        before.chain.filter((r) => r.body.kind === 'activate'),
      );
      expect(after.bindings.get('retained-document')).toEqual(
        before.bindings.get('retained-document'),
      );
      expect(f.fetches).toHaveLength(owner.entries.length);
    },
  );
  it('coalesces concurrent callers and bounds repeated failures/cooldown without background work', async () => {
    const { f } = await retained();
    const g = await f.engine('v1');
    let now = 0;
    g.host.validationNow = () => now;
    const entered = barrier(),
      release = barrier();
    let calls = 0;
    g.host.caches.keys = async () => {
      calls++;
      entered.resolve();
      await release.promise;
      throw Error('access');
    };
    const requests = Array.from({ length: 20 }, () => g.reconcile());
    await entered.promise;
    expect(calls).toBe(1);
    release.resolve();
    expect(await Promise.all(requests)).toEqual(Array(20).fill(false));
    expect(await g.reconcile()).toBe(false);
    expect(calls).toBe(2);
    for (let i = 0; i < 20; i++) expect(await g.reconcile()).toBe(false);
    expect(calls).toBe(2);
    now = Generations.validationCooldown;
    expect(await g.reconcile()).toBe(false);
    expect(calls).toBe(3);
  });
  it.each(['read', 'before-write', 'after-write'])(
    'a hanging %s retains the flight/lock and fences delayed continuation',
    async (point) => {
      const { f } = await retained();
      const g = point === 'read' ? await f.engine('v1') : await f.engine('v2');
      if (point !== 'read') await g.install();
      const entered = barrier(),
        release = barrier();
      let held = false;
      const deadline = new RepairDeadline();
      g.host.scheduleValidationDeadline = deadline.schedule;
      f.hook = async (p, name, _key, response) => {
        if (held || name !== META) return;
        const activation =
          response &&
          (JSON.parse(await response.clone().text()) as Stored).body.kind === 'activate';
        if (
          (point === 'read' && p === 'match') ||
          (activation && p === (point === 'before-write' ? 'beforePut' : 'afterPut'))
        ) {
          held = true;
          entered.resolve();
          await release.promise;
        }
      };
      let underlying: Promise<unknown> | undefined;
      const locks = g.host.locks!;
      g.host.locks = new Proxy(locks, {
        get(target, key) {
          if (key !== 'request') return Reflect.get(target, key);
          return (...args: unknown[]) => {
            const result = Reflect.apply(target.request, target, args) as Promise<unknown>;
            underlying ??= result.then(
              () => {},
              () => {},
            );
            return result;
          };
        },
      });
      const validating = g.reconcile();
      await entered.promise;
      deadline.fire();
      expect(await validating).toBe(false);
      expect(await Promise.all([g.reconcile(), g.reconcile(), g.cleanup()])).toEqual([
        false,
        false,
        false,
      ]);
      expect(await (await g.respond(navigation(), 'timed-out'))!.text()).toBe(recoveryHTML);
      expect((await g.status('', false)).authority).toBe('none');
      release.resolve();
      f.hook = undefined;
      // Await actual writer settlement, then drain its promise continuations.
      await underlying;
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect((await g.status('', false)).authority).toBe('none');
      expect(await g.reconcile()).toBe(true);
      expect(await (await g.respond(navigation(), 'new-live'))!.text()).toBe(
        point === 'read' ? 'v1:/' : 'v2:/',
      );
      expect((await g.snapshot()).chain.filter((r) => r.body.kind === 'activate')).toHaveLength(
        point === 'read' ? 1 : 2,
      );
      expect((await g.status('timed-out')).binding).toBeNull();
    },
  );
  it.each(['missing', 'corrupt', 'unsupported', 'fork'])(
    'transient access then %s metadata stays invalid across eligible retries',
    async (kind) => {
      const { f } = await retained();
      const g = await f.engine('v1');
      failReads(f, 1);
      await g.initialize();
      f.hook = undefined;
      const rows = f.stores.get(META)!;
      if (kind === 'missing') f.stores.delete(META);
      if (kind === 'corrupt')
        rows.set(
          rows.keys().next().value!,
          new Response('{}', { headers: { 'content-type': 'application/json' } }),
        );
      if (kind === 'unsupported') f.stores.set('spendspacey-static-ownership-v99', new Map());
      if (kind === 'fork') {
        const first = JSON.parse(await rows.values().next().value!.clone().text()) as Stored;
        const body = { ...first.body, instance: crypto.randomUUID() };
        const id = await digest(canonical(body));
        rows.set(
          metadataURL(origin, id),
          new Response(canonical({ id, body }), {
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      // Losing metadata before the first successful observation is indistinguishable
      // from a fresh store, but cannot confer ownership without completed provenance.
      expect(await g.reconcile()).toBe(false);
      const denied = await g.status('', false);
      expect(denied.authority).toBe('none');
      if (kind !== 'missing') expect(denied.repair).toBe('blocked');
      for (let n = 0; n < 3; n++) expect(await g.reconcile()).toBe(false);
      expect(f.fetches).toHaveLength(11);
    },
  );
  it.each([1, 3])(
    'restores valid committed owner with %s quarantined same-build reservations, without transfer or cleanup',
    async (count) => {
      const { f, owner } = await retained();
      for (let n = 0; n < count; n++) await (await f.engine('v1')).install();
      const before = await owner.snapshot();
      const resources = [...f.stores.keys()].sort();
      const g = await f.engine('v1');
      expect(await g.reconcile()).toBe(true);
      const restored = await g.snapshot();
      expect(restored).toEqual(before);
      expect(await g.cleanup()).toBe(false);
      expect([...f.stores.keys()].sort()).toEqual(resources);
      await app(g, 'recreated-registration');
      const after = await g.snapshot();
      expect(after.epoch).toBe(before.epoch);
      expect(after.chain.filter((r) => r.body.kind === 'activate')).toHaveLength(1);
      expect(after.bindings.get('retained-document')).toEqual(
        before.bindings.get('retained-document'),
      );
      expect(after.selection).toEqual(before.selection);
    },
  );
  it('ambiguous different-owner transfer still fails closed', async () => {
    const { f, owner } = await retained();
    await (await f.engine('v2')).install();
    await (await f.engine('v2')).install();
    const before = await owner.snapshot();
    const g = await f.engine('v2');
    expect(await g.reconcile()).toBe(false);
    expect(await g.snapshot()).toEqual(before);
    expect(await (await g.respond(navigation(), 'ambiguous'))!.text()).toBe(recoveryHTML);
  });
  it('does not borrow an old pin for empty or reused navigation identities after restoration', async () => {
    const { f } = await retained();
    const g = await f.engine('v1');
    expect(await g.reconcile()).toBe(true);
    for (const id of ['', 'retained-document'])
      expect(await (await g.respond(navigation(), id))!.text()).toBe(recoveryHTML);
    expect((await g.status('')).binding).toBeNull();
    await app(g, 'unique-browser-id');
  });
  it('native authority lost during revalidation never releases application bytes', async () => {
    const { f } = await retained();
    const g = await f.engine('v1');
    f.hook = async (point, name) => {
      if (point === 'match' && name.includes('resource-v3')) g.host.active = () => false;
    };
    expect(await g.reconcile()).toBe(false);
    expect(await (await g.respond(navigation(), 'fenced'))!.text()).toBe(recoveryHTML);
    expect((await g.snapshot()).bindings.has('fenced')).toBe(false);
    expect(
      (await g.respond(
        new Request(
          origin + g.entries.find((entry) => entry.type === 'application/javascript')!.url,
        ),
        '',
        'retained-document',
      ))!.type,
    ).toBe('error');
  });
});

it('queued stale deadline callbacks after success cannot revoke or republish authority', async () => {
  const { f } = await retained();
  const g = await f.engine('v1');
  const deadline = new RepairDeadline();
  g.host.scheduleValidationDeadline = deadline.schedule;
  await app(g, 'before-stale-timer');
  const before = await g.snapshot();
  deadline.fire();
  await app(g, 'after-stale-timer');
  const after = await g.snapshot();
  expect(after.epoch).toBe(before.epoch);
  expect(after.chain.filter((r) => r.body.kind === 'activate')).toHaveLength(1);
});
it('restoration never reverts an adopted repair or consumes another installation', async () => {
  const { f, owner } = await retained();
  await f.damage(owner, 'missing', false, '/assets/supabase-sharedxx.js');
  await owner.respond(navigation(), 'bound-recovery');
  const binding = (await owner.status('bound-recovery')).binding!;
  expect((await owner.repair(crypto.randomUUID(), 'bound-recovery', binding)).repair).toBe(
    'complete',
  );
  await app(owner, 'adopted-repair');
  await (await f.engine('v1')).install();
  const before = await owner.snapshot();
  const g = await f.engine('v1');
  expect(await g.reconcile()).toBe(true);
  expect(await g.snapshot()).toEqual(before);
  await app(g, 'later-document');
  expect((await g.status('later-document')).generation).toBe(
    (await g.status('adopted-repair')).generation,
  );
  expect((await g.snapshot()).chain.filter((r) => r.body.kind === 'activate')).toHaveLength(1);
});

it('invalid immutable inventory is distinct from storage access and never retried as storage', async () => {
  const { f } = await retained();
  const inventory = f.inventories.get('v1')!.map((entry) => ({ ...entry, worker: 'f'.repeat(64) }));
  const g = new Generations(f.host(), inventory);
  let reads = 0;
  g.host.caches.keys = async () => {
    reads++;
    throw Error('must not read');
  };
  await g.initialize();
  for (let n = 0; n < 3; n++) expect(await g.reconcile()).toBe(false);
  expect((await g.status('', false)).repair).toBe('blocked');
  expect(reads).toBe(0);
});

it('read-only preparation and handling evidence cannot grant mutation authority or retry failed startup', async () => {
  const { f, owner } = await retained();
  const g = await f.engine('v1');
  const before = await owner.snapshot();
  const reads = failReads(f, 1);
  await g.initialize();
  const rejectedReads = reads();
  await g.evidence('retained-document', 'handled');
  expect(await g.cleanup()).toBe(false);
  expect(reads()).toBe(rejectedReads);
  await g.initialize(); // Read-only successful validation does not restore the writer epoch.
  await g.evidence('retained-document', 'handled');
  expect(await g.snapshot()).toEqual(before);
  await app(g, 'validated-active-document');
});
