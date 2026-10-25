import { accessibleCaches, StorageAccessFailure, storageAccess } from './access';
import {
  META,
  LOCK,
  PROTOCOL,
  HEX,
  UUID,
  canonical,
  digest,
  boundedBytes,
  validResource,
  generation,
  resourceName,
  metadataURL,
  validateBody,
  browserID,
  type Entry,
  type Descriptor,
  type Op,
  type Stored,
  type Snapshot,
  type RecordBody,
} from './schema';
import {
  validateDescriptor,
  META as OLD_META,
  resourceName as oldResourceName,
  type Completion as OldCompletion,
  type Reservation as OldReservation,
} from './legacy-schema';
import { legacySnapshot } from './legacy';
import { routeRequest } from './policy';
import { recoveryDocument } from './recovery';

export interface GenerationHost {
  origin: string;
  caches: CacheStorage;
  locks?: LockManager;
  fetch: (request: Request) => Promise<Response>;
  windows: () => Promise<readonly { id: string; url: string; visibilityState?: string }[]>;
  busy: () => boolean;
  online: () => boolean;
  // Native running-instance proof; never a URL, build identity or page assertion.
  active: () => boolean;
  validationNow?: () => number;
  scheduleValidationDeadline?: (callback: () => void, milliseconds: number) => () => void;
  repairDeadline?: number;
  scheduleRepairDeadline?: (callback: () => void, milliseconds: number) => () => void;
}
export interface WorkerInventory extends Entry {
  worker: string;
  implementation: string;
  compatibility: string;
  legacyCompatibility: string;
}
export interface StaticStatus {
  authority: 'recovery' | 'application' | 'none';
  prepared: boolean;
  ready: boolean;
  pending: boolean;
  worker: string;
  epoch: string | null;
  binding: string | null;
  generation: string | null;
  repair:
    | 'idle'
    | 'complete'
    | 'failed'
    | 'timed-out'
    | 'cancelled'
    | 'busy'
    | 'offline'
    | 'blocked'
    | 'unknown'
    | 'spent'
    | 'unavailable';
}
type Reserve = Extract<RecordBody, { kind: 'reserve' }>;
type Deliver = Extract<RecordBody, { kind: 'deliver' }>;
type Attempt = Extract<RecordBody, { kind: 'attempt' }>;
type TerminalDecision = Readonly<
  Pick<Extract<RecordBody, { kind: 'finish' }>, 'outcome' | 'completion'>
>;
type RepairFlight = { controller: AbortController; decision: TerminalDecision | null };
const repairLock = LOCK + '-repair';
// Only these worker-owned identities confer cancellation/deadline meaning.
const cancellationReason = Symbol('authorized repair cancellation');
const deadlineReason = Symbol('repair deadline');

// Every mutation uses the same origin-wide Web Lock, including install/cutover,
// staging, selection, document ownership, evidence, and deletion seals. No local fallback.
export class Generations {
  readonly worker: string;
  readonly implementation: string;
  readonly compatibility: string;
  readonly legacyCompatibility: string;
  readonly entries: Entry[];
  descriptor!: Descriptor;
  private buildValidation?: Promise<void>;
  private invalid: 'build' | 'state' | null = null;
  private validated = false;
  private authorityReady = false;
  private capturedStartup = false;
  private failures = 0;
  private retryAfter = 0;
  private validationFlight?: { active: boolean; expired: boolean; view: Promise<boolean> };
  // Two failed flights per burst; later eligible events may retry after five seconds.
  // The two-second caller deadline never releases the underlying writer lock/flight.
  static readonly validationAttempts = 2;
  static readonly validationCooldown = 5000;
  static readonly validationDeadline = 2000;
  private unavailable = false;
  private sawLedger = false;
  private epoch: string | null = null;
  private startupEpoch: string | null = null;
  private controllers = new Map<string, RepairFlight>();
  constructor(
    readonly host: GenerationHost,
    inventory: WorkerInventory[],
  ) {
    host.caches = accessibleCaches(host.caches);
    const first = inventory[0];
    if (
      !first ||
      inventory.some((e) =>
        ['worker', 'implementation', 'compatibility', 'legacyCompatibility'].some(
          (k) => e[k as keyof WorkerInventory] !== first[k as keyof WorkerInventory],
        ),
      ) ||
      [first.worker, first.implementation, first.compatibility, first.legacyCompatibility].some(
        (v) => !HEX.test(v),
      )
    )
      throw new Error('Invalid build inventory');
    this.worker = first.worker;
    this.implementation = first.implementation;
    this.compatibility = first.compatibility;
    this.legacyCompatibility = first.legacyCompatibility;
    this.entries = inventory.map(({ url, key, revision, integrity, type, bytes }) => ({
      url,
      key,
      revision,
      integrity,
      type,
      bytes,
    }));
  }
  private async run<T>(op: () => Promise<T>): Promise<T> {
    if (!this.host.locks) return Promise.reject(new Error('Shared serialization unavailable'));
    return await this.host.locks.request(LOCK, { mode: 'exclusive' }, op);
  }
  private fail(error: unknown) {
    this.unavailable = true;
    this.validated = false;
    this.authorityReady = false;
    if (!(error instanceof StorageAccessFailure)) this.invalid = 'state';
  }
  private async validateBuild() {
    return (this.buildValidation ??= (async () => {
      try {
        if (
          (await digest(
            canonical({
              entries: this.entries,
              compatibility: this.compatibility,
              legacyCompatibility: this.legacyCompatibility,
              implementation: this.implementation,
            }),
          )) !== this.worker
        )
          throw new Error('Worker identity');
        this.descriptor = await validateDescriptor(
          {
            schema: 2,
            origin: this.host.origin,
            scope: '/',
            compatibility: this.compatibility,
            generation: await generation(this.entries, this.compatibility),
            entries: this.entries,
          },
          this.host.origin,
          this.compatibility,
        );
      } catch (error) {
        this.invalid = 'build';
        this.unavailable = true;
        throw error;
      }
    })());
  }
  private async validate(active: boolean): Promise<boolean> {
    if (this.invalid || (active && !this.host.active())) return false;
    const existing = this.validationFlight;
    if (existing) {
      const complete = await existing.view;
      // A read-only preparation flight cannot grant mutation authority.
      return complete && active && !existing.active ? this.validate(true) : complete;
    }
    if (this.validated && (!active || (this.authorityReady && this.host.active()))) return true;
    const now = (this.host.validationNow ?? Date.now)();
    if (this.failures >= Generations.validationAttempts) {
      if (now < this.retryAfter) return false;
      this.failures = 0; // Only the retry budget resets, never observed durable state.
    }
    let finish!: (value: boolean) => void;
    const flight = {
      active,
      expired: false,
      view: new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
    };
    this.validationFlight = flight;
    let disarm = () => {};
    let settled = false;
    const settle = (complete: boolean) => {
      settled = true;
      disarm();
      if (this.validationFlight === flight) this.validationFlight = undefined;
      finish(complete);
    };
    const unavailable = () => {
      this.unavailable = true;
      this.validated = false;
      this.authorityReady = false;
      this.failures++;
      this.retryAfter = (this.host.validationNow ?? Date.now)() + Generations.validationCooldown;
    };
    const schedule =
      this.host.scheduleValidationDeadline ??
      ((callback, milliseconds) => {
        const timer = setTimeout(callback, milliseconds);
        return () => clearTimeout(timer);
      });
    disarm = schedule(() => {
      if (settled || flight.expired) return;
      flight.expired = true;
      unavailable();
      finish(false);
      // Keep flight and writer lock until the underlying operation settles.
    }, Generations.validationDeadline);
    void this.run(async () => {
      await this.validateBuild();
      const s = await this.snapshot();
      if (!this.capturedStartup) {
        this.startupEpoch = s.epoch;
        this.capturedStartup = true;
      }
      if ([...s.records.values()].some((r) => r.kind === 'cutover')) {
        try {
          await this.legacyHistory(s);
        } catch (error) {
          this.fail(error);
          throw error;
        }
      }
      if (flight.expired) return false;
      // Validation may now write only under this exclusive lock and live flight.
      this.unavailable = false;
      if (active) await this.restoreActivation(() => !flight.expired && this.host.active());
      if (flight.expired) return false;
      this.validated = true;
      this.authorityReady = active;
      this.failures = 0;
      return true;
    }).then(
      (complete) => settle(complete),
      (error) => {
        if (!flight.expired && !this.invalid) unavailable();
        void error;
        // Invalid durable state is latched by snapshot at the validation boundary.
        // Rejected authority/transfer never becomes permission to mutate.
        this.unavailable = true;
        this.validated = false;
        this.authorityReady = false;
        settle(false);
      },
    );
    return flight.view;
  }
  async initialize(): Promise<void> {
    await this.validate(false);
  }
  async snapshot(extra?: Stored): Promise<Snapshot> {
    let records: Map<string, RecordBody>;
    try {
      records = await this.readRecords();
      await this.lineage(records);
    } catch (error) {
      this.fail(error);
      throw error;
    }
    // Invalid proposed transitions must not poison otherwise valid durable state.
    if (extra) records.set(extra.id, extra.body);
    return this.lineage(records);
  }
  private async readRecords(): Promise<Map<string, RecordBody>> {
    const names = await this.host.caches.keys();
    if (names.some((n) => n.startsWith('spendspacey-static-ownership-v') && n !== META))
      throw new Error('Unsupported ownership namespace');
    if (this.sawLedger && !names.includes(META)) throw new Error('Ownership storage lost');
    const records = new Map<string, RecordBody>();
    if (names.includes(META)) {
      const cache = await this.host.caches.open(META);
      const requests = await cache.keys();
      if (requests.length > 4096) throw new Error('Metadata bound exhausted');
      let size = 0;
      // Bound parallel I/O without weakening per-record or aggregate limits.
      for (let offset = 0; offset < requests.length; offset += 8) {
        const batch = await Promise.all(
          requests.slice(offset, offset + 8).map(async (request) => {
            const response = await cache.match(request);
            if (!response || response.headers.get('content-type') !== 'application/json')
              throw new Error('Invalid metadata response');
            const bytes = await boundedBytes(response, 64 * 1024);
            size += bytes.length;
            if (size > 8 * 1024 * 1024) throw new Error('Metadata bytes exhausted');
            const raw: unknown = JSON.parse(new TextDecoder().decode(bytes));
            if (
              !raw ||
              typeof raw !== 'object' ||
              Object.keys(raw).sort().join() !== 'body,id' ||
              !('id' in raw) ||
              !('body' in raw) ||
              typeof raw.id !== 'string' ||
              request.url !== metadataURL(this.host.origin, raw.id) ||
              (await digest(canonical(raw.body))) !== raw.id
            )
              throw new Error('Metadata identity');
            return [
              raw.id,
              await validateBody(
                raw.body,
                this.host.origin,
                this.compatibility,
                this.legacyCompatibility,
              ),
            ] as const;
          }),
        );
        for (const [id, body] of batch) records.set(id, body);
      }
    }
    if (this.sawLedger && !records.size) throw new Error('Ledger evicted');
    if (records.size) this.sawLedger = true;
    return records;
  }
  private async lineage(records: Map<string, RecordBody>): Promise<Snapshot> {
    // Only one complete immutable lineage is authoritative; a mutable head is neither read nor written.
    const children = new Map<string | null, Stored>();
    for (const [id, body] of records) {
      if (children.has(body.parent)) throw new Error('Ledger fork');
      children.set(body.parent, { id, body });
    }
    const chain: Stored[] = [];
    let cursor = children.get(null);
    while (cursor) {
      if (cursor.body.sequence !== chain.length || chain.length >= records.size)
        throw new Error('Ledger sequence');
      chain.push(cursor);
      cursor = children.get(cursor.id);
    }
    if (chain.length !== records.size) throw new Error('Missing lineage');
    const seen = new Map<string, RecordBody>();
    const bindings = new Map<string, Stored>();
    const sealed = new Set<string>();
    const instances = new Set<string>();
    const finished = new Set<string>();
    const boundReservations = new Set<string>();
    const abandoned = new Set<string>();
    const requests = new Set<string>();
    const selectedBefore = new Set<string>();
    let selection: Stored | null = null,
      epoch: string | null = null,
      owner: string | null = null;
    const ref = (id: string | null, kind: RecordBody['kind']) => {
      const r = id ? seen.get(id) : null;
      if (!r || r.kind !== kind) throw new Error('Missing reference');
      return r;
    };
    const unsealed = (id: string | null) => {
      if (id && sealed.has(id)) throw new Error('Sealed generation referenced');
    };
    for (const record of chain) {
      const b = record.body;
      if (b.epoch !== epoch) throw new Error('Stale writer epoch');
      const waitingWrite =
        (b.kind === 'reserve' && b.purpose === 'install') ||
        (b.kind === 'complete' && (ref(b.reservation, 'reserve') as Reserve).purpose === 'install');
      if (owner && b.worker !== owner && !waitingWrite && b.kind !== 'activate')
        throw new Error('Stale writer');
      if (b.kind === 'reserve') {
        if (instances.has(b.instance)) throw new Error('Duplicate resource ownership');
        instances.add(b.instance);
        if (b.purpose !== 'import' && (b.producer !== b.worker || b.legacy))
          throw new Error('Producer mismatch');
        if (b.legacy !== (b.purpose === 'import')) throw new Error('Invalid import');
        const identity = {
          entries: b.descriptor.entries,
          compatibility: b.descriptor.compatibility,
          implementation: b.implementation,
        };
        if (
          (await digest(
            canonical(
              b.legacy ? identity : { ...identity, legacyCompatibility: this.legacyCompatibility },
            ),
          )) !== b.producer
        )
          throw new Error('Build proof');
        if (b.source && b.purpose !== 'import') {
          ref(b.source, 'complete');
          unsealed(b.source);
        }
        if (b.purpose === 'repair') {
          const a = ref(b.attempt, 'attempt') as Attempt;
          if (a.instance !== b.instance || a.worker !== b.worker)
            throw new Error('Repair reservation');
        } else if (b.attempt !== null) throw new Error('Unexpected attempt');
        if (
          b.purpose === 'import' &&
          !chain
            .slice(0, b.sequence)
            .some((r) => r.body.kind === 'cutover' && r.body.protected.includes(b.source!))
        )
          throw new Error('Unvalidated import');
      }
      if (b.kind === 'complete') {
        const r = ref(b.reservation, 'reserve') as Reserve;
        if (
          r.worker !== b.worker ||
          [...seen.values()].some((v) => v.kind === 'complete' && v.reservation === b.reservation)
        )
          throw new Error('Completion ownership');
        if (
          r.purpose === 'import' &&
          [...seen.values()].some((v) => v.kind === 'cutover' && v.eligible.includes(r.source!))
        )
          selectedBefore.add(record.id);
      }
      if (b.kind === 'activate') {
        const r = ref(b.installation, 'reserve') as Reserve;
        if (
          r.worker !== b.worker ||
          r.purpose !== 'install' ||
          r.epoch !== epoch ||
          b.nextEpoch === epoch
        )
          throw new Error('Activation fence');
        for (const id of [b.selected, b.fallback])
          if (id) {
            ref(id, 'complete');
            unsealed(id);
          }
        if (b.selected === b.fallback && b.selected) throw new Error('Duplicate selection');
        if (b.fallback && !selectedBefore.has(b.fallback))
          throw new Error('Never selected fallback');
        if (b.selected) {
          const c = ref(b.selected, 'complete') as Extract<RecordBody, { kind: 'complete' }>;
          const r = ref(c.reservation, 'reserve') as Reserve;
          if (
            !selectedBefore.has(b.selected) &&
            r.purpose !== 'import' &&
            c.reservation !== b.installation
          )
            throw new Error('Ineligible activation');
          selectedBefore.add(b.selected);
        }
        epoch = b.nextEpoch;
        owner = b.worker;
        selection = record;
      }
      if (b.kind === 'navigation') {
        if (
          !owner ||
          bindings.has(b.client) ||
          [...seen.values()].some(
            (v) =>
              v.kind === 'navigation' && (v.client === b.client || v.navigation === b.navigation),
          )
        )
          throw new Error('Duplicate browser ownership');
        for (const id of b.references) {
          ref(id, 'complete');
          unsealed(id);
        }
      }
      if (b.kind === 'deliver') {
        const n = ref(b.reservation, 'navigation') as Extract<RecordBody, { kind: 'navigation' }>;
        if (
          n.client !== b.client ||
          abandoned.has(b.reservation) ||
          boundReservations.has(b.reservation) ||
          bindings.has(b.client) ||
          b.selection !== selection?.id
        )
          throw new Error('Binding fence');
        for (const id of [b.generation, b.selected, b.fallback])
          if (id) {
            ref(id, 'complete');
            unsealed(id);
          }
        if (b.selected === b.fallback && b.selected) throw new Error('Duplicate fallback');
        const previous = selection?.body;
        if (!previous || (previous.kind !== 'activate' && previous.kind !== 'deliver'))
          throw new Error('Missing selection');
        const changed = b.selected !== previous.selected || b.fallback !== previous.fallback;
        if (n.mode === 'callback' && (b.recovery || changed || b.adoption))
          throw new Error('Callback promotion');
        if (b.generation && !n.references.includes(b.generation))
          throw new Error('Unreserved delivery');
        if (b.recoveryRequest) {
          ref(b.recoveryRequest, 'recovery-request');
          if (
            !b.recovery ||
            [...seen.values()].some(
              (v) => v.kind === 'deliver' && v.recoveryRequest === b.recoveryRequest,
            )
          )
            throw new Error('Recovery request consumed');
        }
        if (changed) {
          if (!b.selected || b.generation !== b.selected || b.recovery)
            throw new Error('Invalid joint selection');
          if (b.adoption) {
            const f = ref(b.adoption, 'finish') as Extract<RecordBody, { kind: 'finish' }>;
            const a = ref(f.attempt, 'attempt') as Attempt;
            if (f.outcome !== 'complete' || f.completion !== b.selected || a.base !== selection.id)
              throw new Error('Invalid repair adoption');
          } else if (!selectedBefore.has(b.selected) || b.selected !== previous.fallback)
            throw new Error('Unknown rollback');
          if (b.fallback && !selectedBefore.has(b.fallback)) throw new Error('Unknown fallback');
          selection = record;
          selectedBefore.add(b.selected);
        } else if (b.adoption !== null) throw new Error('Spurious adoption');
        bindings.set(b.client, record);
        boundReservations.add(b.reservation);
      }
      if (b.kind === 'abandon') {
        ref(b.reservation, 'navigation');
        if (boundReservations.has(b.reservation) || abandoned.has(b.reservation))
          throw new Error('Cannot abandon delivery');
        abandoned.add(b.reservation);
      }
      if (b.kind === 'recovery-request') {
        const d = ref(b.binding, 'deliver') as Deliver;
        const n = ref(d.reservation, 'navigation') as Extract<RecordBody, { kind: 'navigation' }>;
        if (d.recovery || n.mode !== 'shell' || requests.has(b.request))
          throw new Error('Invalid recovery request');
        requests.add(b.request);
      }
      if (b.kind === 'cancel') {
        const a = ref(b.attempt, 'attempt') as Attempt;
        if (a.binding !== b.binding || requests.has(b.request))
          throw new Error('Invalid cancellation');
        ref(b.binding, 'deliver');
        requests.add(b.request);
      }
      if (b.kind === 'confirm' || b.kind === 'evidence') {
        ref(b.binding, 'deliver');
        if (b.kind === 'confirm' && requests.has(b.request)) throw new Error('Replayed evidence');
        if (b.kind === 'confirm') requests.add(b.request);
      }
      if (b.kind === 'attempt') {
        const d = ref(b.binding, 'deliver') as Deliver;
        if (
          !d.recovery ||
          b.base !== selection?.id ||
          requests.has(b.request) ||
          instances.has(b.instance)
        )
          throw new Error('Repair boundary');
        requests.add(b.request);
        if (b.source) {
          ref(b.source, 'complete');
          unsealed(b.source);
        }
      }
      if (b.kind === 'finish') {
        ref(b.attempt, 'attempt');
        if (finished.has(b.attempt)) throw new Error('Duplicate outcome');
        finished.add(b.attempt);
        if (b.completion) {
          const c = ref(b.completion, 'complete') as Extract<RecordBody, { kind: 'complete' }>;
          const r = ref(c.reservation, 'reserve') as Reserve;
          if (r.attempt !== b.attempt) throw new Error('Outcome binding');
        }
      }
      if (b.kind === 'cutover') {
        if (owner || [...seen.values()].some((v) => v.kind === 'cutover'))
          throw new Error('Duplicate cutover');
        for (const a of b.attempts) {
          if (requests.has(a.request)) throw new Error('Conflicting history');
          requests.add(a.request);
        }
      }
      if (b.kind === 'legacy-update') {
        ref(b.cutover, 'cutover');
        const previous = [...seen.values()]
          .filter((v) => v.kind === 'cutover' || v.kind === 'legacy-update')
          .at(-1)!;
        if (previous.kind !== 'cutover' && previous.kind !== 'legacy-update')
          throw new Error('Missing cutover history');
        for (const old of previous.attempts)
          if (!b.attempts.some((a) => a.request === old.request))
            throw new Error('Lost spent attempt');
        for (const a of b.attempts) {
          if (requests.has(a.request) && !previous.attempts.some((p) => p.request === a.request))
            throw new Error('Conflicting imported request');
          requests.add(a.request);
        }
      }
      if (b.kind === 'seal') {
        // Recompute protection from durable evidence, not a caller's cleanup claim.
        const protectedSet = this.protected(seen, selection, bindings);
        for (const id of b.generations) {
          ref(id, 'complete');
          if (sealed.has(id) || protectedSet.has(id)) throw new Error('Unsafe deletion seal');
          sealed.add(id);
        }
      }
      if (b.kind === 'deleted') ref(b.seal, 'seal');
      seen.set(record.id, b);
    }
    return {
      records: new Map(chain.map(({ id, body }) => [id, body])),
      chain,
      head: chain.at(-1) ?? null,
      selection,
      epoch,
      owner,
      bindings,
      sealed,
    };
  }
  private protected(
    records: Map<string, RecordBody>,
    selection: Stored | null,
    bindings: Map<string, Stored>,
  ) {
    const p = new Set<string>();
    const selected = selection?.body;
    if (selected && (selected.kind === 'activate' || selected.kind === 'deliver'))
      for (const id of [selected.selected, selected.fallback]) if (id) p.add(id);
    // A possibly delivered document is never retired by absence or a timeout.
    for (const d of bindings.values())
      if (d.body.kind === 'deliver' && d.body.generation) p.add(d.body.generation);
    const completed = new Set(
      [...records.values()].filter((v) => v.kind === 'complete').map((v) => v.reservation),
    );
    const abandoned = new Set(
      [...records.values()].filter((v) => v.kind === 'abandon').map((v) => v.reservation),
    );
    const delivered = new Set(
      [...records.values()].filter((v) => v.kind === 'deliver').map((v) => v.reservation),
    );
    for (const [id, b] of records) {
      if (b.kind === 'navigation' && !abandoned.has(id) && !delivered.has(id))
        b.references.forEach((v) => p.add(v));
      if (b.kind === 'reserve' && !completed.has(id) && b.source && !b.legacy) p.add(b.source);
      if (
        b.kind === 'attempt' &&
        ![...records.values()].some((v) => v.kind === 'finish' && v.attempt === id) &&
        b.source
      )
        p.add(b.source);
      if (
        b.kind === 'finish' &&
        b.outcome === 'complete' &&
        b.completion &&
        ![...records.values()].some((v) => v.kind === 'deliver' && v.adoption === id)
      )
        p.add(b.completion);
      // A never-activated installation remains protected (another worker may be waiting).
      if (b.kind === 'complete') {
        const r = records.get(b.reservation);
        if (
          r?.kind === 'reserve' &&
          r.purpose === 'install' &&
          ![...records.values()].some(
            (v) => v.kind === 'activate' && v.installation === b.reservation,
          )
        )
          p.add(id);
      }
    }
    return p;
  }
  private async append(
    s: Snapshot,
    op: Op,
    installing = false,
    authority?: () => boolean,
  ): Promise<Stored> {
    if (this.unavailable || this.validationFlight?.expired) throw new Error('Unavailable ledger');
    if (
      !installing &&
      ((!this.authorityReady && !authority) ||
        !this.host.active() ||
        s.owner !== this.worker ||
        s.epoch !== this.epoch)
    )
      throw new Error('Writer fenced');
    const now = await this.snapshot();
    if (now.head?.id !== s.head?.id || now.epoch !== s.epoch) throw new Error('Head changed');
    if (now.records.size >= 4096) throw new Error('Metadata exhausted');
    const body: RecordBody = {
      ...op,
      schema: 3,
      origin: this.host.origin,
      compatibility: this.compatibility,
      worker: this.worker,
      epoch: s.epoch,
      parent: s.head?.id ?? null,
      sequence: s.chain.length,
    };
    await validateBody(body, this.host.origin, this.compatibility, this.legacyCompatibility);
    const id = await digest(canonical(body));
    const record = { id, body };
    await this.snapshot(record); // Validate the proposed transition before writing untrusted input.
    const cache = await this.host.caches.open(META);
    if (
      this.unavailable ||
      this.validationFlight?.expired ||
      (!installing && !this.host.active()) ||
      (authority && !authority())
    )
      throw new Error('Browser-active authority lost');
    await cache.put(
      metadataURL(this.host.origin, id),
      new Response(canonical(record), { headers: { 'content-type': 'application/json' } }),
    );
    const read = await cache.match(metadataURL(this.host.origin, id));
    if (!read || (await storageAccess(() => read.text())) !== canonical(record))
      throw new Error('Commit read-back failed');
    const restored = await this.snapshot();
    if (restored.head?.id !== id) throw new Error('Commit lineage failed');
    this.sawLedger = true;
    return record;
  }
  private resource(s: Snapshot, id: string) {
    const c = s.records.get(id);
    if (c?.kind !== 'complete' || s.sealed.has(id)) throw new Error('Unknown or sealed generation');
    const r = s.records.get(c.reservation);
    if (r?.kind !== 'reserve') throw new Error('Missing resource owner');
    return r;
  }
  async verify(s: Snapshot, id: string | null): Promise<boolean> {
    try {
      if (!id) return false;
      const r = this.resource(s, id),
        name = resourceName(r);
      if (!(await this.host.caches.has(name))) return false;
      const cache = await this.host.caches.open(name),
        actual = await cache.keys();
      if (
        actual.length !== r.descriptor.entries.length ||
        actual.some((v) => !r.descriptor.entries.some((e) => this.host.origin + e.key === v.url))
      )
        return false;
      const verified = await Promise.all(
        r.descriptor.entries.map(async (entry) => {
          const response = await cache.match(this.host.origin + entry.key);
          return !!response && (await validResource(entry, response, this.host.origin));
        }),
      );
      if (!verified.every(Boolean)) return false;
      return true;
    } catch (error) {
      if (error instanceof StorageAccessFailure) {
        this.fail(error);
        throw error;
      }
      return false;
    }
  }
  // Diagnostic only. Storage exceptions and invalid metadata do not prove loss.
  private async resourceLoss(s: Snapshot, id: string | null): Promise<boolean> {
    try {
      if (!id) return false;
      const r = this.resource(s, id);
      const name = resourceName(r);
      if (!(await this.host.caches.has(name))) return true;
      const cache = await this.host.caches.open(name);
      for (const entry of r.descriptor.entries) {
        const response = await cache.match(this.host.origin + entry.key);
        if (!response || !(await validResource(entry, response, this.host.origin))) return true;
      }
    } catch {
      /* Unknown is not proven missing/corrupt. */
    }
    return false;
  }
  private async exact(s: Snapshot, id: string, path: string): Promise<Response> {
    const r = this.resource(s, id);
    const e = r.descriptor.entries.find((v) => v.url === path);
    if (!e) throw new Error('Not in document inventory');
    const response = await (
      await this.host.caches.open(resourceName(r))
    ).match(this.host.origin + e.key);
    if (!response || !(await validResource(e, response, this.host.origin)))
      throw new Error('Unverified response');
    // Return independently verified, captured bytes, not a later mutable Cache lookup.
    return new Response((await boundedBytes(response, e.bytes)) as Uint8Array<ArrayBuffer>, {
      status: 200,
      headers: response.headers,
    });
  }
  private async fill(
    r: Reserve,
    signal?: AbortSignal,
    source?: { cache: Cache; descriptor: Descriptor },
  ) {
    const target = await this.host.caches.open(resourceName(r));
    for (const entry of r.descriptor.entries) {
      signal?.throwIfAborted();
      let response =
        source && source.descriptor.entries.some((e) => canonical(e) === canonical(entry))
          ? await source.cache.match(this.host.origin + entry.key)
          : undefined;
      if (response && !(await validResource(entry, response, this.host.origin)))
        response = undefined;
      if (!response)
        response = await this.host.fetch(
          new Request(this.host.origin + entry.url, {
            method: 'GET',
            credentials: 'omit',
            redirect: 'error',
            cache: 'no-store',
            integrity: entry.integrity,
            signal,
          }),
        );
      if (!(await validResource(entry, response, this.host.origin)))
        throw new Error('Static verification failed');
      signal?.throwIfAborted();
      const verified = response;
      await this.run(async () => {
        const s = await this.snapshot();
        if (
          s.epoch !== r.epoch ||
          ![...s.records.values()].some(
            (v) => v.kind === 'reserve' && v.instance === r.instance && v.worker === this.worker,
          )
        )
          throw new Error('Staging writer fenced');
        signal?.throwIfAborted();
        await target.put(this.host.origin + entry.key, verified);
      });
    }
  }
  private async complete(reservation: string, epoch: string | null, installing = false) {
    return this.run(async () => {
      const s = await this.snapshot(),
        r = s.records.get(reservation);
      if (s.epoch !== epoch || r?.kind !== 'reserve' || r.worker !== this.worker)
        throw new Error('Staging fenced');
      // Verify the complete exact inventory before publishing completion metadata.
      const cache = await this.host.caches.open(resourceName(r));
      const actual = await cache.keys();
      if (actual.length !== r.descriptor.entries.length) throw new Error('Incomplete staging');
      for (const e of r.descriptor.entries) {
        const response = await cache.match(this.host.origin + e.key);
        if (!response || !(await validResource(e, response, this.host.origin)))
          throw new Error('Incomplete staging');
      }
      return this.append(s, { kind: 'complete', reservation }, installing);
    });
  }
  private async legacyHistory(s: Snapshot) {
    const cut = [...s.records].find(([, b]) => b.kind === 'cutover');
    if (!cut) return null;
    if (!(await this.host.caches.has(OLD_META))) throw new Error('Legacy evidence evicted');
    const old = await legacySnapshot(this.host.caches, this.host.origin, this.legacyCompatibility);
    const prior = [...s.records.values()]
      .filter((b) => b.kind === 'cutover' || b.kind === 'legacy-update')
      .at(-1)!;
    if (prior.kind !== 'cutover' && prior.kind !== 'legacy-update')
      throw new Error('Missing historical proof');
    if (prior.legacyHead && !old.chain.some((r) => r.id === prior.legacyHead))
      throw new Error('Legacy lineage changed');
    const attempts = [...old.records]
      .filter(([, r]) => r.kind === 'attempt')
      .map(([id, a]) => {
        const f = [...old.records.values()].find((r) => r.kind === 'finish' && r.attempt === id);
        return {
          request: (a as { request: string }).request,
          outcome: f?.kind === 'finish' ? f.outcome : ('unknown' as const),
        };
      });
    for (const a of prior.attempts) {
      const current = attempts.find((v) => v.request === a.request);
      if (!current || (a.outcome !== 'unknown' && a.outcome !== current.outcome))
        throw new Error('Lost or contradictory legacy budget');
    }
    const eligible = new Set(
      old.chain.map((r) => (r.body.kind === 'select' ? r.body.selected : null)),
    );
    if (
      prior.eligible.some((id) => !eligible.has(id)) ||
      prior.protected.some((id) => old.records.get(id)?.kind !== 'complete')
    )
      throw new Error('Lost legacy evidence');
    return {
      cutover: cut[0],
      legacyHead: old.head?.id ?? null,
      legacyDigest: await digest(canonical([...old.records].sort())),
      attempts,
      eligible: [
        ...new Set(
          old.chain
            .map((r) => (r.body.kind === 'select' ? r.body.selected : null))
            .filter((v): v is string => !!v),
        ),
      ],
      protected: [...old.records].filter(([, r]) => r.kind === 'complete').map(([id]) => id),
      prior,
    };
  }
  private async refreshLegacy(s: Snapshot, authority?: () => boolean) {
    const history = await this.legacyHistory(s);
    if (history && history.legacyDigest !== history.prior.legacyDigest) {
      const { prior: _, ...update } = history;
      void _;
      await this.append(s, { kind: 'legacy-update', ...update }, false, authority);
      return this.snapshot();
    }
    return s;
  }
  private async cutover() {
    if (!(await this.host.caches.has(OLD_META))) return;
    const start = await this.run(async () => {
      const s = await this.snapshot();
      if (s.records.size) return null;
      const old = await legacySnapshot(
        this.host.caches,
        this.host.origin,
        this.legacyCompatibility,
      );
      const attempts = [...old.records.entries()]
        .filter(([, r]) => r.kind === 'attempt')
        .map(([id, a]) => {
          const f = [...old.records.values()].find((r) => r.kind === 'finish' && r.attempt === id);
          return {
            request: (a as { request: string }).request,
            outcome: f?.kind === 'finish' ? f.outcome : ('unknown' as const),
          };
        });
      const refs = [...old.records.entries()]
        .filter(([, r]) => r.kind === 'complete')
        .map(([id]) => id);
      await this.append(
        s,
        {
          kind: 'cutover',
          legacyHead: old.head?.id ?? null,
          legacyDigest: await digest(canonical([...old.records].sort())),
          attempts,
          protected: refs,
          eligible: [
            ...new Set(
              old.chain
                .map((r) => (r.body.kind === 'select' ? r.body.selected : null))
                .filter((v): v is string => !!v),
            ),
          ],
        },
        true,
      );
      return old;
    });
    if (!start) return;
    const head = start.head?.body;
    if (head?.kind !== 'select') return;
    for (const source of [head.selected, head.fallback]) {
      if (!source) continue;
      const c = start.records.get(source) as OldCompletion;
      const old = start.records.get(c.reservation) as OldReservation;
      const reservation = await this.run(async () => {
        const s = await this.snapshot();
        return this.append(
          s,
          {
            kind: 'reserve',
            instance: crypto.randomUUID(),
            purpose: 'import',
            source,
            attempt: null,
            generation: c.descriptor.generation,
            descriptor: c.descriptor,
            producer: old.worker,
            implementation: old.implementation,
            legacy: true,
          },
          true,
        );
      });
      const r = reservation.body as Reserve;
      // Copy only previously validated legacy inventory; never repair import from network.
      const oldCache = await this.host.caches.open(oldResourceName(old)),
        target = await this.host.caches.open(resourceName(r));
      try {
        const actual = await oldCache.keys();
        if (actual.length !== c.descriptor.entries.length)
          throw new Error('Incomplete legacy generation');
        for (const e of c.descriptor.entries) {
          const response = await oldCache.match(this.host.origin + e.key);
          if (!response || !(await validResource(e, response, this.host.origin)))
            throw new Error('Unverified import');
          await this.run(async () => {
            const s = await this.snapshot();
            if (s.epoch !== r.epoch) throw new Error('Import fenced');
            await target.put(this.host.origin + e.key, response);
          });
        }
        await this.complete(reservation.id, reservation.body.epoch, true);
      } catch {
        /* Interrupted or damaged import never creates usable completion. Legacy untouched. */
      }
    }
  }
  async install(): Promise<void> {
    await this.initialize();
    if (this.unavailable) throw new Error('Initialization unavailable');
    await this.cutover();
    const reservation = await this.run(async () => {
      const s = await this.snapshot();
      if (s.epoch !== this.startupEpoch) throw new Error('Installation epoch changed');
      return this.append(
        s,
        {
          kind: 'reserve',
          instance: crypto.randomUUID(),
          purpose: 'install',
          generation: this.descriptor.generation,
          source: null,
          attempt: null,
          descriptor: this.descriptor,
          producer: this.worker,
          implementation: this.implementation,
          legacy: false,
        },
        true,
      );
    });
    await this.fill(reservation.body as Reserve);
    await this.complete(reservation.id, reservation.body.epoch, true);
  }
  unavailableResponse(request: Request): Promise<Response> | Response {
    return routeRequest(request, this.host.origin, new Set([request.url])) === 'shell'
      ? recoveryDocument()
      : Response.error();
  }
  // Functional events retry once under the writer lock, not through a permanently
  // rejected activate-event promise. No network, repair or cleanup is performed.
  async reconcile(): Promise<boolean> {
    return this.validate(true);
  }
  async activate(): Promise<void> {
    if (!(await this.validate(true))) throw new Error('Activation validation unavailable');
  }
  private async restoreActivation(authority: () => boolean): Promise<void> {
    if (!authority()) throw new Error('Not the browser-active worker');
    const s = await this.snapshot();
    const eligible = [...s.records].filter(
      ([id, r]) =>
        r.kind === 'reserve' &&
        r.purpose === 'install' &&
        r.worker === this.worker &&
        r.epoch === s.epoch &&
        !s.chain.some((v) => v.body.kind === 'activate' && v.body.installation === id),
    );
    if (s.owner === this.worker) {
      // Build equality establishes compatibility, not reservation identity.
      // Restore only the already committed epoch/selection. Pending installations
      // remain unrelated, protected and unconsumed, even for this same build.
      const selection = s.selection?.body;
      if (!s.epoch || !selection || (selection.kind !== 'activate' && selection.kind !== 'deliver'))
        throw new Error('Invalid committed ownership');
      await this.verify(s, selection.selected);
      await this.verify(s, selection.fallback);
      const current = await this.snapshot();
      if (
        !authority() ||
        current.head?.id !== s.head?.id ||
        current.epoch !== s.epoch ||
        current.owner !== s.owner
      )
        throw new Error('Ownership restoration fenced');
      // Missing resources confer no application authority: respond must verify and
      // bind a recovery document instead. Never reconstruct a generation here.
      this.epoch = s.epoch;
      return;
    }
    if (eligible.length !== 1) throw new Error('No unique fenced installation');
    const install = eligible[0];
    const latest = [...s.records]
      .filter(([, r]) => r.kind === 'reserve' && r.purpose === 'install' && r.epoch === s.epoch)
      .at(-1);
    if (latest?.[0] !== install[0]) throw new Error('Superseded installation');
    const candidate =
      [...s.records].find(([, r]) => r.kind === 'complete' && r.reservation === install[0])?.[0] ??
      null;
    if (!candidate) throw new Error('No completed installation');
    const prior = s.selection?.body;
    const previous =
      prior && (prior.kind === 'activate' || prior.kind === 'deliver') ? prior.selected : null;
    const rollback =
      prior && (prior.kind === 'activate' || prior.kind === 'deliver') ? prior.fallback : null;
    const imports = [...s.records]
      .filter(
        ([, r]) =>
          r.kind === 'complete' && (s.records.get(r.reservation) as Reserve).purpose === 'import',
      )
      .map(([id]) => id);
    let selected: string | null = null;
    for (const id of [candidate, previous, rollback, ...imports])
      if (await this.verify(s, id)) {
        selected = id;
        break;
      }
    let fallback: string | null = null;
    for (const id of [previous, rollback, ...imports])
      if (id !== selected && (await this.verify(s, id))) {
        fallback = id;
        break;
      }
    await this.legacyHistory(s);
    const nextEpoch = crypto.randomUUID();
    await this.append(
      s,
      { kind: 'activate', installation: install[0], selected, fallback, nextEpoch },
      true,
      authority,
    );
    if (!authority()) throw new Error('Activation continuation fenced');
    this.epoch = nextEpoch;
    await this.refreshLegacy(await this.snapshot(), authority);
  }
  private pending(s: Snapshot) {
    return [...s.records]
      .filter(
        ([, b]) =>
          b.kind === 'finish' &&
          b.outcome === 'complete' &&
          (s.records.get(b.attempt) as Attempt).base === s.selection?.id,
      )
      .at(-1);
  }
  // No client lookup or enumeration is required to authorize delivery. Browser-issued
  // resultingClientId is reserved durably; all existing bindings remain immutable.
  async respond(request: Request, incoming = '', client = ''): Promise<Response | undefined> {
    const kind = routeRequest(request, this.host.origin, new Set([request.url]));
    if (kind === 'network') return undefined;
    if (!(await this.validate(true))) return this.unavailableResponse(request);
    if (kind === 'static') {
      try {
        return await this.run(async () => {
          if (this.unavailable || !browserID(client)) return Response.error();
          const s = await this.snapshot(),
            b = s.bindings.get(client)?.body;
          if (b?.kind !== 'deliver' || !b.generation || !(await this.verify(s, b.generation)))
            return Response.error();
          return this.exact(s, b.generation, new URL(request.url).pathname);
        });
      } catch {
        return Response.error();
      }
    }
    if (!browserID(incoming)) return kind === 'shell' ? recoveryDocument() : Response.error();
    try {
      return await this.run(async () => {
        if (this.unavailable) throw new Error('Unavailable');
        let s = await this.snapshot();
        if (s.owner !== this.worker || s.epoch !== this.epoch)
          throw new Error('Stale navigation writer');
        if (
          s.bindings.has(incoming) ||
          [...s.records.values()].some((r) => r.kind === 'navigation' && r.client === incoming)
        )
          throw new Error('Duplicate navigation identity');
        // Fence never-bound interrupted reservations. Bound records are never abandoned.
        for (const [id, r] of s.records)
          if (
            r.kind === 'navigation' &&
            ![...s.records.values()].some(
              (b) => (b.kind === 'deliver' || b.kind === 'abandon') && b.reservation === id,
            )
          ) {
            await this.append(s, { kind: 'abandon', reservation: id, outcome: 'abandoned' });
            s = await this.snapshot();
          }
        const selection = s.selection?.body;
        if (!selection || (selection.kind !== 'activate' && selection.kind !== 'deliver'))
          throw new Error('No committed selection');
        let selected = selection.selected,
          fallback = selection.fallback,
          adoption: string | null = null;
        let chosen: string | null = null;
        const recoveryRequest =
          [...s.records]
            .filter(
              ([id, b]) =>
                b.kind === 'recovery-request' &&
                ![...s.records.values()].some(
                  (v) => v.kind === 'deliver' && v.recoveryRequest === id,
                ),
            )
            .at(-1)?.[0] ?? null;
        const pending = this.pending(s);
        if (kind === 'shell' && recoveryRequest) {
          chosen = null;
        } else if (
          kind === 'shell' &&
          pending?.[1].kind === 'finish' &&
          (await this.verify(s, pending[1].completion))
        ) {
          chosen = pending[1].completion;
          adoption = pending[0];
          fallback = (await this.verify(s, selected))
            ? selected
            : (await this.verify(s, fallback))
              ? fallback
              : null;
          selected = chosen;
        } else if (await this.verify(s, selected)) chosen = selected;
        else if (kind === 'shell' && (await this.verify(s, fallback))) {
          chosen = fallback;
          selected = fallback;
          fallback = null;
        }
        // Imported v2 UI cannot speak the corrected control protocol. Keep its
        // verified rollback selection, but use the independent canonical recovery
        // entry until the corrected application can be adopted. Never reinterpret
        // a legacy privileged message or inject code into its verified document.
        if (kind === 'shell' && chosen && this.resource(s, chosen).legacy) chosen = null;
        if (kind === 'callback' && !chosen) return Response.error();
        const references = Array.from(
          new Set([chosen, selected, fallback].filter((v): v is string => !!v)),
        );
        const n = await this.append(s, {
          kind: 'navigation',
          navigation: crypto.randomUUID(),
          client: incoming,
          mode: kind === 'shell' ? 'shell' : 'callback',
          references,
        });
        s = await this.snapshot();
        // Verify the candidate and capture its exact bytes before the joint commit.
        const lost =
          !chosen &&
          !recoveryRequest &&
          ((await this.resourceLoss(s, selected)) || (await this.resourceLoss(s, fallback)));
        let response = chosen ? await this.exact(s, chosen, '/') : await recoveryDocument(lost);
        if (chosen && !(await this.verify(s, chosen))) throw new Error('Candidate changed');
        await this.append(s, {
          kind: 'deliver',
          reservation: n.id,
          client: incoming,
          generation: chosen,
          recovery: chosen === null,
          selection: s.selection?.id ?? null,
          selected,
          fallback,
          adoption,
          recoveryRequest: kind === 'shell' ? recoveryRequest : null,
        });
        s = await this.snapshot();
        // Eviction after persistence must not release application bytes or invent a pin.
        const committed = s.bindings.get(incoming)?.body;
        if (
          committed?.kind !== 'deliver' ||
          committed.generation !== chosen ||
          (chosen && !(await this.verify(s, chosen)))
        )
          throw new Error('Delivery lost storage');
        if (chosen) response = await this.exact(s, chosen, '/');
        if (!this.host.active()) throw new Error('Delivery authority lost');
        if (kind === 'callback') {
          const headers = new Headers(response.headers);
          headers.set('cache-control', 'no-store');
          headers.set('referrer-policy', 'no-referrer');
          response = new Response(response.body, { status: 200, headers });
        }
        return response;
      });
    } catch {
      // Only a never-bound reservation can be positively fenced as failed. A
      // committed delivery remains potentially received even when read-back fails.
      try {
        await this.run(async () => {
          const s = await this.snapshot();
          if (s.owner !== this.worker || s.epoch !== this.epoch) return;
          const n = [...s.records].find(
            ([, b]) => b.kind === 'navigation' && b.client === incoming,
          );
          if (
            n &&
            ![...s.records.values()].some(
              (b) => (b.kind === 'deliver' || b.kind === 'abandon') && b.reservation === n[0],
            )
          )
            await this.append(s, {
              kind: 'abandon',
              reservation: n[0],
              outcome: 'delivery-failed',
            });
        });
      } catch {
        /* Unproven ownership remains protected. */
      }
      return kind === 'shell' ? recoveryDocument() : Response.error();
    }
  }
  async evidence(client: string, result: 'handled' | 'handling-error'): Promise<void> {
    // Handling evidence is not a new event eligible to retry startup or grant authority.
    if (this.unavailable || !this.authorityReady) return;
    try {
      await this.run(async () => {
        const s = await this.snapshot();
        const b = s.bindings.get(client);
        if (!b || s.owner !== this.worker || s.epoch !== this.epoch) return;
        if (
          [...s.records.values()].some(
            (v) => v.kind === 'evidence' && v.binding === b.id && v.result === result,
          )
        )
          return;
        await this.append(s, { kind: 'evidence', binding: b.id, result });
      });
    } catch {
      /* Evidence never changes ownership. */
    }
  }
  async status(client = '', revalidate = true): Promise<StaticStatus> {
    if (revalidate) await this.initialize();
    const result: StaticStatus = {
      authority: 'none',
      prepared: false,
      ready: false,
      pending: false,
      worker: this.worker,
      epoch: null,
      binding: null,
      generation: null,
      repair: this.invalid ? 'blocked' : 'unavailable',
    };
    if (this.unavailable || this.validationFlight?.expired) return result;
    try {
      return await this.run(async () => {
        if (this.unavailable) return result;
        const s = await this.snapshot(),
          b = s.bindings.get(client),
          d = b?.body;
        result.epoch = s.epoch;
        result.binding = b?.id ?? null;
        result.authority =
          d?.kind === 'deliver' ? (d.recovery ? 'recovery' : 'application') : 'none';
        result.generation = d?.kind === 'deliver' ? d.generation : null;
        result.ready = !!result.generation && (await this.verify(s, result.generation));
        const own =
          [...s.records]
            .filter(
              ([, v]) =>
                v.kind === 'complete' &&
                (s.records.get(v.reservation) as Reserve).producer === this.worker,
            )
            .at(-1)?.[0] ?? null;
        result.prepared = await this.verify(s, own);
        const pending = this.pending(s);
        const repaired =
          !!pending &&
          pending[1].kind === 'finish' &&
          (await this.verify(s, pending[1].completion));
        result.pending = repaired || !result.prepared;
        result.repair = repaired ? 'complete' : 'idle';
        const a = [...s.records].filter(([, v]) => v.kind === 'attempt').at(-1);
        if (a) {
          const f = [...s.records.values()].find((v) => v.kind === 'finish' && v.attempt === a[0]);
          result.repair =
            f?.kind === 'finish'
              ? f.outcome === 'complete'
                ? repaired
                  ? 'complete'
                  : 'spent'
                : f.outcome
              : this.controllers.size
                ? 'busy'
                : 'unknown';
        } else {
          const cut = [...s.records.values()]
            .filter((v) => v.kind === 'cutover' || v.kind === 'legacy-update')
            .at(-1);
          if ((cut?.kind === 'cutover' || cut?.kind === 'legacy-update') && cut.attempts.length)
            result.repair = cut.attempts.some((a) => a.outcome === 'unknown') ? 'unknown' : 'spent';
        }
        if (
          !this.host.online() &&
          !['busy', 'complete', 'unknown', 'failed', 'timed-out', 'cancelled', 'spent'].includes(
            result.repair,
          )
        )
          result.repair = 'offline';
        return result;
      });
    } catch {
      return {
        ...result,
        authority: 'none',
        binding: null,
        epoch: null,
        generation: null,
        ready: false,
        prepared: false,
        pending: false,
        repair: this.invalid ? 'blocked' : 'unavailable',
      };
    }
  }
  // Strict v3 protocol. Caller IDs/URLs/generation claims never supply authority.
  async message(
    data: unknown,
    source: { id: string; url: string } | null,
    origin: string,
    revalidate = true,
  ): Promise<StaticStatus | undefined> {
    if (revalidate) await this.initialize();
    if (
      !source ||
      origin !== this.host.origin ||
      !browserID(source.id) ||
      new URL(source.url).origin !== this.host.origin ||
      !data ||
      typeof data !== 'object'
    )
      return;
    const d = data as Record<string, unknown>;
    if (
      d.protocol !== PROTOCOL ||
      typeof d.request !== 'string' ||
      !UUID.test(d.request) ||
      !['HELLO', 'STATUS', 'CONFIRM', 'RECOVERY', 'REPAIR', 'CANCEL'].includes(String(d.operation))
    )
      return;
    const hello = d.operation === 'HELLO';
    if (
      Object.keys(d).sort().join() !==
      (hello ? 'operation,protocol,request' : 'binding,epoch,operation,protocol,request,worker')
    )
      return;
    if (!hello && !(await this.validate(true))) return this.status(source.id, false);
    const current = await this.status(source.id, false);
    if (hello) return current;
    if (
      !current.binding ||
      d.binding !== current.binding ||
      d.worker !== this.worker ||
      d.epoch !== current.epoch
    )
      return;
    try {
      if (d.operation === 'CONFIRM')
        await this.run(async () => {
          const s = await this.snapshot();
          const b = s.bindings.get(source.id);
          if (!b || b.id !== d.binding || s.epoch !== d.epoch || s.owner !== this.worker) return;
          if (
            [...s.records.values()].some(
              (v) => v.kind === 'confirm' && (v.binding === b.id || v.request === d.request),
            )
          )
            return;
          await this.append(s, { kind: 'confirm', binding: b.id, request: d.request as string });
        });
      if (d.operation === 'RECOVERY')
        await this.run(async () => {
          const s = await this.snapshot(),
            b = s.bindings.get(source.id);
          if (
            !b ||
            b.id !== d.binding ||
            b.body.kind !== 'deliver' ||
            b.body.recovery ||
            s.epoch !== d.epoch
          )
            throw new Error('Recovery request fenced');
          if (
            [...s.records.values()].some(
              (v) =>
                (v.kind === 'recovery-request' || v.kind === 'confirm' || v.kind === 'attempt') &&
                v.request === d.request,
            )
          )
            return;
          await this.append(s, {
            kind: 'recovery-request',
            binding: b.id,
            request: d.request as string,
          });
        });
      if (d.operation === 'REPAIR') return this.repair(d.request, source.id, d.binding as string);
      if (d.operation === 'CANCEL')
        await this.run(async () => {
          const s = await this.snapshot();
          const b = s.bindings.get(source.id);
          if (
            !b ||
            b.id !== d.binding ||
            b.body.kind !== 'deliver' ||
            !b.body.recovery ||
            s.epoch !== d.epoch
          )
            return;
          for (const [attempt, flight] of this.controllers) {
            const { controller } = flight;
            if (controller.signal.aborted || flight.decision) continue;
            const a = s.records.get(attempt);
            if (a?.kind === 'attempt' && a.binding === b.id) {
              if ([...s.records.values()].some((v) => 'request' in v && v.request === d.request))
                return;
              await this.append(s, {
                kind: 'cancel',
                binding: b.id,
                request: d.request as string,
                attempt,
              });
              // Authorization can yield through persistence/read-back. Priority
              // starts at the actual first abort, never at message arrival/put.
              if (!controller.signal.aborted && !flight.decision)
                controller.abort(cancellationReason);
            }
          }
        });
      return this.status(source.id);
    } catch {
      return { ...current, ready: false, repair: 'unavailable' };
    }
  }
  async repair(request: string, client: string, binding: string): Promise<StaticStatus> {
    await this.validate(true);
    if (this.unavailable) return this.status(client, false);
    if (!this.host.locks || !UUID.test(request))
      return { ...(await this.status(client)), repair: 'blocked' };
    return this.host.locks.request(
      repairLock,
      { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        if (!lock) return { ...(await this.status(client)), repair: 'busy' };
        let attempt: Stored | null = null;
        let reservation: Stored | null = null;
        const controller = new AbortController();
        const flight: RepairFlight = { controller, decision: null };
        let disarm: (() => void) | undefined;
        let uncertain = false;
        const select = (decision: TerminalDecision) => {
          flight.decision ??= Object.freeze(decision);
          disarm?.();
          return flight.decision;
        };
        try {
          const start = await this.run(async () => {
            const s = await this.refreshLegacy(await this.snapshot()),
              b = s.bindings.get(client);
            if (
              this.unavailable ||
              s.owner !== this.worker ||
              s.epoch !== this.epoch ||
              b?.id !== binding ||
              b.body.kind !== 'deliver' ||
              !b.body.recovery ||
              !this.host.online()
            )
              throw new Error('Repair not authorized');
            if (
              [...s.records.values()].some(
                (v) =>
                  (v.kind === 'attempt' && v.request === request) ||
                  ((v.kind === 'cutover' || v.kind === 'legacy-update') &&
                    v.attempts.some((a) => a.request === request)),
              )
            )
              return null;
            const pending = this.pending(s);
            if (pending?.[1].kind === 'finish' && (await this.verify(s, pending[1].completion)))
              return null;
            const selected = s.selection?.body;
            if (!selected || (selected.kind !== 'activate' && selected.kind !== 'deliver'))
              throw new Error('No repair base');
            let source: string | null = null;
            for (const id of [selected.selected, selected.fallback])
              if (id && !s.sealed.has(id)) {
                source = id;
                break;
              }
            const instance = crypto.randomUUID();
            attempt = await this.append(s, {
              kind: 'attempt',
              request,
              binding,
              source,
              base: s.selection!.id,
              instance,
            });
            const next = await this.snapshot();
            reservation = await this.append(next, {
              kind: 'reserve',
              instance,
              purpose: 'repair',
              source,
              attempt: attempt.id,
              generation: this.descriptor.generation,
              descriptor: this.descriptor,
              producer: this.worker,
              implementation: this.implementation,
              legacy: false,
            });
            return { source, snapshot: await this.snapshot() };
          });
          if (!start || !attempt || !reservation) return this.status(client);
          const activeAttempt = attempt as Stored,
            activeReservation = reservation as Stored;
          this.controllers.set(activeAttempt.id, flight);
          const onDeadline = () => {
            if (controller.signal.aborted || flight.decision) return;
            controller.abort(deadlineReason);
          };
          if (this.host.scheduleRepairDeadline)
            disarm = this.host.scheduleRepairDeadline(
              onDeadline,
              this.host.repairDeadline ?? 12000,
            );
          else {
            const timer = setTimeout(onDeadline, this.host.repairDeadline ?? 12000);
            disarm = () => clearTimeout(timer);
          }
          const r = activeReservation.body as Reserve;
          let source: { cache: Cache; descriptor: Descriptor } | undefined;
          if (start.source) {
            const owner = this.resource(start.snapshot, start.source);
            source = {
              cache: await this.host.caches.open(resourceName(owner)),
              descriptor: owner.descriptor,
            };
          }
          await this.fill(r, controller.signal, source);
          const completion = await this.complete(
            activeReservation.id,
            activeReservation.body.epoch,
          );
          await this.run(async () => {
            const s = await this.snapshot();
            controller.signal.throwIfAborted();
            const decision = select({ outcome: 'complete', completion: completion.id });
            await this.append(s, {
              kind: 'finish',
              attempt: activeAttempt.id,
              ...decision,
            });
          });
        } catch {
          // Freeze synchronously before any awaited lock/snapshot/persistence.
          // A selected success whose persistence failed must never become failure.
          const alreadySelected = flight.decision !== null;
          const decision = select({
            outcome:
              controller.signal.reason === cancellationReason
                ? 'cancelled'
                : controller.signal.reason === deadlineReason
                  ? 'timed-out'
                  : 'failed',
            completion: null,
          });
          if (alreadySelected) uncertain = true;
          else if (attempt)
            try {
              await this.run(async () => {
                const s = await this.snapshot();
                if (
                  [...s.records.values()].some(
                    (v) => v.kind === 'finish' && v.attempt === (attempt as Stored).id,
                  )
                )
                  return;
                await this.append(s, {
                  kind: 'finish',
                  attempt: (attempt as Stored).id,
                  ...decision,
                });
              });
            } catch {
              uncertain = true;
              /* No durable outcome means unknown/interrupted, never invented failure. */
            }
        } finally {
          disarm?.();
          if (attempt) this.controllers.delete((attempt as Stored).id);
        }
        const status = await this.status(client);
        // This operation could not validate its finish. Only a later independent
        // STATUS/restart may resolve a possibly successful write/read-back.
        return uncertain ? { ...status, repair: 'unknown' as const } : status;
      },
    );
  }
  async cleanup(): Promise<boolean> {
    // Cleanup cannot turn an unavailable event into a second startup attempt.
    if (this.unavailable || this.validationFlight?.expired) return false;
    if (!(await this.validate(true))) return false;
    // Observations may hang. They are outside the decision lock and do not retire a pin.
    const observedHead = await this.run(async () => (await this.snapshot()).head?.id ?? null).catch(
      () => null,
    );
    const windows = await this.host.windows();
    return this.run(async () => {
      if (this.unavailable) return false;
      let s = await this.snapshot();
      if (
        !this.host.active() ||
        [...s.records].some(
          ([id, r]) =>
            r.kind === 'reserve' &&
            r.purpose === 'install' &&
            !s.chain.some((v) => v.body.kind === 'activate' && v.body.installation === id),
        ) ||
        s.head?.id !== observedHead ||
        s.owner !== this.worker ||
        s.epoch !== this.epoch ||
        this.host.busy()
      )
        return false;
      const retained = s.selection?.body;
      if (
        !retained ||
        (retained.kind !== 'activate' && retained.kind !== 'deliver') ||
        (!(await this.verify(s, retained.selected)) && !(await this.verify(s, retained.fallback)))
      )
        return false;
      // Resume already sealed deletion idempotently, independent of current enumeration.
      for (const [id, b] of s.records)
        if (
          b.kind === 'seal' &&
          ![...s.records.values()].some((v) => v.kind === 'deleted' && v.seal === id)
        ) {
          for (const ref of b.generations) {
            const c = s.records.get(ref);
            if (c?.kind !== 'complete') throw new Error('Lost deletion owner');
            const r = s.records.get(c.reservation) as Reserve;
            await this.host.caches.delete(resourceName(r));
          }
          await this.append(s, { kind: 'deleted', seal: id });
          s = await this.snapshot();
        }
      // Any legacy/live/unidentified window blocks new seals. Missing windows never unpin.
      if (windows.length || [...s.records.values()].some((v) => v.kind === 'cutover')) return false;
      const chosen = s.selection?.body;
      if (
        !chosen ||
        (chosen.kind !== 'activate' && chosen.kind !== 'deliver') ||
        !(await this.verify(s, chosen.selected)) ||
        !(await this.verify(s, chosen.fallback))
      )
        return false;
      const protectedSet = this.protected(s.records, s.selection, s.bindings);
      const candidates = [...s.records]
        .filter(([id, r]) => r.kind === 'complete' && !s.sealed.has(id) && !protectedSet.has(id))
        .map(([id]) => id);
      if (!candidates.length) return false;
      const seal = await this.append(s, { kind: 'seal', generations: candidates });
      for (const ref of candidates) {
        s = await this.snapshot();
        const c = s.records.get(ref) as Extract<RecordBody, { kind: 'complete' }>;
        const r = s.records.get(c.reservation) as Reserve;
        await this.host.caches.delete(resourceName(r));
      }
      await this.append(await this.snapshot(), { kind: 'deleted', seal: seal.id });
      return true;
    });
  }
}
