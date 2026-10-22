import { setImmediate } from 'node:timers/promises';
import { describe, expect, it, onTestFailed } from 'vitest';
import { StaticFixture, navigation, origin } from '../../test/staticGenerations';
import { barrier, blockRepair, RepairDeadline } from '../../test/repairOutcomes';
import { LOCK, META, resourceName, type Stored } from '../../worker/schema';
import { recoveryHTML, resourceRecoveryHTML } from '../../worker/recovery';
import type { StaticStatus } from '../../worker/generations';

type Outcome = 'complete' | 'failed' | 'cancelled' | 'timed-out';
const repetitions = Number(process.env.REPAIR_RACE_REPETITIONS ?? 1);
if (!Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 100)
  throw Error('Invalid repair race repetition count');

async function setup(constrained: boolean, trace: string[]) {
  const f = new StaticFixture();
  const g = await f.engine('v1');
  await g.install();
  await g.activate();
  await f.damage(g, 'missing', false, '/assets/supabase-sharedxx.js');
  expect(await (await g.respond(navigation('/'), 'recovery-1'))!.text()).toBeOneOf([
    recoveryHTML,
    resourceRecoveryHTML,
  ]);
  const authority = await g.status('recovery-1');
  const base = (await f.completion(g)).ref;
  const before = f.fetches.length;
  const deadline = new RepairDeadline((event) => trace.push(event));
  g.host.scheduleRepairDeadline = deadline.schedule;
  const blocked = blockRepair(f, g);
  const request = crypto.randomUUID();
  const cancelled = crypto.randomUUID();
  const writes: Outcome[] = [];
  const written = new Map<string, string>();
  let onEvent: (event: string) => Promise<void> = async () => {};
  let completionRead = false;
  let completionValidated = false;
  let terminalSnapshot = false;
  let finishStarted = false;
  let finishRead = false;
  let lineageChecked = false;
  let repairLocked = false;
  let statusPublished = false;
  const selected = barrier();
  const schedule = async () => {
    if (constrained) await setImmediate();
  };
  const event = async (name: string) => {
    trace.push(name);
    await schedule();
    await onEvent(name);
  };
  const scheduleDeadline = g.host.scheduleRepairDeadline;
  g.host.scheduleRepairDeadline = (callback, milliseconds) => {
    const disarm = scheduleDeadline(callback, milliseconds);
    return () => {
      disarm();
      selected.resolve();
    };
  };
  f.hook = async (point, name, key, response) => {
    await schedule();
    if (name !== META) return;
    if (response && (point === 'beforePut' || point === 'afterPut')) {
      const body = ((await response.clone().json()) as Stored).body;
      if (point === 'beforePut' && body.kind === 'finish') {
        finishStarted = true;
        writes.push(body.outcome);
      }
      if (point === 'afterPut') written.set(key, body.kind);
      await event(body.kind + (point === 'beforePut' ? ':write' : ':written'));
    }
    if (point === 'match' && written.has(key)) {
      const kind = written.get(key)!;
      written.delete(key);
      if (kind === 'complete') completionRead = true;
      if (kind === 'finish') finishRead = true;
      await event(kind + ':readback');
    }
  };
  const locks = f.locks.request.bind(f.locks);
  g.host.locks = {
    request: (
      name: string,
      options: LockOptions,
      callback: (lock: Lock | null) => Promise<unknown>,
    ) =>
      locks(name, options, async (lock) => {
        if (name === LOCK + '-repair' && lock) {
          repairLocked = true;
          trace.push('repair lock acquired');
        }
        try {
          return await callback(lock);
        } finally {
          if (name === LOCK && completionRead) completionValidated = true;
          if (name === LOCK + '-repair' && lock) {
            repairLocked = false;
            trace.push('repair lock released');
          }
        }
      }),
  } as LockManager;
  const snapshot = g.snapshot.bind(g);
  g.snapshot = async (...args) => {
    if (!args[0] && finishRead && !lineageChecked) {
      lineageChecked = true;
      await event('finish:lineage');
    }
    if (
      !args[0] &&
      !terminalSnapshot &&
      !finishStarted &&
      (completionValidated || (deadline.callback && !deadline.armed))
    ) {
      terminalSnapshot = true;
      await event('terminal:snapshot');
    }
    return snapshot(...args);
  };
  const status = g.status.bind(g);
  g.status = async (...args) => {
    const result = await status(...args);
    if (finishStarted && !statusPublished) {
      statusPublished = true;
      await event('status:publication');
    }
    trace.push('status published: ' + result.repair);
    return result;
  };
  const pending = g.repair(request, 'recovery-1', authority.binding!).then((result) => {
    trace.push('repair result: ' + result.repair);
    return result;
  });
  const network = await blocked.entered;
  network.signal.addEventListener('abort', () =>
    trace.push('actual authorized abort: ' + String(network.signal.reason)),
  );
  expect((await f.records()).filter((r) => r.body.kind === 'attempt')).toHaveLength(1);
  const cancel = (id = cancelled) =>
    g.message(
      {
        protocol: 3,
        operation: 'CANCEL',
        request: id,
        worker: authority.worker,
        epoch: authority.epoch,
        binding: authority.binding,
      },
      { id: 'recovery-1', url: origin + '/' },
      origin,
    );
  return {
    f,
    g,
    request,
    before,
    base,
    deadline,
    blocked,
    pending,
    network,
    cancel,
    writes,
    binding: authority.binding!,
    selected: selected.promise,
    locked: () => repairLocked,
    on: (fn: typeof onEvent) => {
      onEvent = fn;
    },
    async conclude(immediate: StaticStatus['repair'], durable = immediate) {
      expect((await pending).repair).toBe(immediate);
      expect(repairLocked).toBe(false);
      const count = f.fetches.length;
      expect(count - before).toBe(1);
      const repairRequest = f.fetches.at(-1)!;
      expect(repairRequest.url).toBe(origin + '/assets/supabase-sharedxx.js');
      expect(repairRequest.method).toBe('GET');
      expect(repairRequest.credentials).toBe('omit');
      expect(repairRequest.redirect).toBe('error');
      // The only repair request is an approved static SDK file, never execution,
      // Supabase/Google/OAuth/Auth/user/session/profile/API traffic.
      expect((await g.status('recovery-1')).repair).toBe(durable);
      const restart = await f.engine('v1');
      await restart.initialize();
      expect((await restart.status('recovery-1')).repair).toBe(durable);
      await restart.repair(request, 'recovery-1', authority.binding!);
      expect(
        (await restart.snapshot()).chain.filter((r) => r.body.kind === 'attempt'),
      ).toHaveLength(1);
      expect(writes).toHaveLength(1);
      const s = await restart.snapshot();
      const finish = s.chain.find((r) => r.body.kind === 'finish');
      if (durable === 'unknown') expect(finish).toBeUndefined();
      else expect(finish?.body).toMatchObject({ kind: 'finish', outcome: durable });
      const reserve = s.chain.find(
        (r) => r.body.kind === 'reserve' && r.body.purpose === 'repair',
      )!;
      if (reserve.body.kind !== 'reserve') throw Error('Missing staging reservation');
      const staging = f.stores.get(resourceName(reserve.body))!;
      const response = (await restart.respond(navigation('/'), 'reopened'))!;
      if (durable === 'complete') expect(await response.text()).toBe('v1:/');
      else {
        expect(await response.text()).toBeOneOf([recoveryHTML, resourceRecoveryHTML]);
        expect((await f.completion(restart)).ref).toBe(base);
      }
      if (!s.chain.some((r) => r.body.kind === 'complete' && r.body.reservation === reserve.id))
        expect(staging.size).toBeLessThan(g.entries.length);
      expect(f.fetches).toHaveLength(count);
    },
  };
}

type Scenario = Awaited<ReturnType<typeof setup>>;
const cases: [string, (s: Scenario) => Promise<void>][] = [
  [
    'cancellation first; stale deadline cannot replace it',
    async (s) => {
      await s.cancel();
      s.deadline.fire();
      expect(typeof s.network.signal.reason).toBe('symbol');
      await s.conclude('cancelled');
    },
  ],
  [
    'deadline first; cancellation cannot replace it',
    async (s) => {
      s.deadline.fire();
      const reason = s.network.signal.reason;
      await s.cancel();
      expect(s.network.signal.reason).toBe(reason);
      await s.conclude('timed-out');
    },
  ],
  [
    'same turn: cancellation abort then deadline callback',
    async (s) => {
      s.network.signal.addEventListener('abort', () => s.deadline.fire(), { once: true });
      await s.cancel();
      await s.conclude('cancelled');
    },
  ],
  [
    'same turn: deadline callback then cancellation dispatch',
    async (s) => {
      s.deadline.fire();
      const cancel = s.cancel();
      await cancel;
      await s.conclude('timed-out');
    },
  ],
  ...['cancel:write', 'cancel:written', 'cancel:readback'].map(
    (boundary): [string, (s: Scenario) => Promise<void>] => [
      'deadline during ' + boundary,
      async (s) => {
        s.on(async (event) => {
          if (event === boundary) s.deadline.fire();
        });
        await s.cancel();
        expect((await s.f.records()).some((r) => r.body.kind === 'cancel')).toBe(true);
        await s.conclude('timed-out');
      },
    ],
  ),
  [
    'slow cancellation persistence: deadline wins before authorization settles',
    async (s) => {
      const entered = barrier(),
        resume = barrier();
      s.on(async (event) => {
        if (event === 'cancel:write') {
          entered.resolve();
          await resume.promise;
        }
      });
      const cancel = s.cancel();
      await entered.promise;
      expect(s.network.signal.aborted).toBe(false);
      s.deadline.fire();
      expect(s.locked()).toBe(true);
      resume.resolve();
      await cancel;
      await s.conclude('timed-out');
    },
  ],
  [
    'ordinary failure freezes while cancellation authorization is still pending',
    async (s) => {
      const entered = barrier(),
        resume = barrier();
      s.on(async (event) => {
        if (event === 'cancel:readback') {
          entered.resolve();
          await resume.promise;
        }
      });
      const cancel = s.cancel();
      await entered.promise;
      s.f.failPath = s.f.delayPath;
      s.blocked.release();
      await s.selected;
      s.deadline.fire();
      expect(s.network.signal.aborted).toBe(false);
      resume.resolve();
      await cancel;
      expect(s.network.signal.aborted).toBe(false);
      await s.conclude('failed');
    },
  ],
  [
    'deadline during final pre-selection snapshot wins over success',
    async (s) => {
      s.on(async (event) => {
        if (event === 'terminal:snapshot') s.deadline.fire();
      });
      s.blocked.release();
      await s.conclude('timed-out');
    },
  ],
  [
    'deadline during failure terminal snapshot cannot replace observed failure',
    async (s) => {
      s.on(async (event) => {
        if (event === 'terminal:snapshot') s.deadline.fire();
      });
      s.f.failPath = s.f.delayPath;
      s.blocked.release();
      await s.conclude('failed');
      expect(s.network.signal.aborted).toBe(false);
    },
  ],
  [
    'cancellation first stays cancelled through deadline during terminal snapshot',
    async (s) => {
      s.on(async (event) => {
        if (event === 'terminal:snapshot') s.deadline.fire();
      });
      await s.cancel();
      await s.conclude('cancelled');
    },
  ],
  ...(['AbortError', 'TimeoutError'] as const).map(
    (name): [string, (s: Scenario) => Promise<void>] => [
      'unrelated thrown ' + name + ' remains ordinary failure',
      async (s) => {
        s.f.transform = () => {
          throw new DOMException('ordinary fixture error', name);
        };
        s.blocked.release();
        await s.conclude('failed');
        expect(s.network.signal.aborted).toBe(false);
      },
    ],
  ),
  [
    'unrelated symbol with a sentinel-like description remains failure',
    async (s) => {
      s.f.transform = () => {
        throw Symbol('authorized repair cancellation');
      };
      s.blocked.release();
      await s.conclude('failed');
    },
  ],
  [
    'repair lock remains held through final status publication',
    async (s) => {
      const entered = barrier(),
        resume = barrier();
      s.on(async (event) => {
        if (event === 'status:publication') {
          entered.resolve();
          await resume.promise;
        }
      });
      s.blocked.release();
      await entered.promise;
      expect(s.locked()).toBe(true);
      s.deadline.fire();
      expect(s.network.signal.aborted).toBe(false);
      resume.resolve();
      await s.conclude('complete');
    },
  ],
];
for (const outcome of ['complete', 'failed', 'cancelled', 'timed-out'] as const) {
  const stop = async (s: Scenario) => {
    if (outcome === 'cancelled') return s.cancel();
    if (outcome === 'timed-out') s.deadline.fire();
    else {
      if (outcome === 'failed') s.f.failPath = s.f.delayPath;
      s.blocked.release();
    }
  };
  for (const boundary of ['finish:write', 'finish:readback', 'finish:lineage']) {
    cases.push([
      outcome + ' stays frozen during ' + boundary + ' and retains repair lock',
      async (s) => {
        const entered = barrier(),
          resume = barrier();
        s.on(async (event) => {
          if (event === boundary) {
            entered.resolve();
            await resume.promise;
          }
        });
        const stopping = stop(s);
        await entered.promise;
        expect(s.deadline.armed).toBe(false);
        const reason = s.network.signal.reason;
        s.deadline.fire();
        expect(s.network.signal.reason).toBe(reason);
        expect(s.locked()).toBe(true);
        let competitorSettled = false;
        const count = s.f.fetches.length;
        const competing = s.g.repair(crypto.randomUUID(), 'recovery-1', s.binding).then((v) => {
          competitorSettled = true;
          return v;
        });
        const cancelling = s.cancel(crypto.randomUUID());
        await setImmediate();
        expect(competitorSettled).toBe(false);
        expect(s.f.fetches).toHaveLength(count);
        expect(s.locked()).toBe(true);
        resume.resolve();
        await stopping;
        await competing;
        await cancelling;
        expect(s.network.signal.reason).toBe(reason);
        await s.conclude(outcome);
      },
    ]);
    cases.push([
      outcome + ' reports uncertainty when ' + boundary + ' rejects',
      async (s) => {
        let failed = false;
        s.on(async (event) => {
          if (event === boundary && !failed) {
            failed = true;
            throw Error('interrupted ' + boundary);
          }
        });
        await stop(s);
        await s.conclude('unknown', boundary === 'finish:write' ? 'unknown' : outcome);
      },
    ]);
  }
}

describe.each(['ordinary', 'constrained'] as const)(
  'deterministic repair outcome ordering (%s)',
  (mode) => {
    it.each(cases)(
      '%s',
      async (_name, run) => {
        let activeTrace: string[] = [];
        onTestFailed(() => {
          console.error('Ordered repair diagnostics:\n' + activeTrace.join('\n'));
        });
        for (let repetition = 0; repetition < repetitions; repetition++) {
          const trace: string[] = [];
          activeTrace = trace;
          try {
            await run(await setup(mode === 'constrained', trace));
          } catch (cause) {
            throw new Error(
              `Repair ordering failure: ${mode}, repetition ${repetition + 1}/${repetitions}\n` +
                trace.map((entry, index) => `${index + 1}. ${entry}`).join('\n'),
              { cause },
            );
          }
        }
      },
      120_000,
    );
  },
);
