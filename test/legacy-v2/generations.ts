// Frozen 069dbc50 implementation: test-only cutover evidence, never bundled.
import {
  META,
  LOCK,
  canonical,
  digest,
  boundedBytes,
  validateBody,
  validateDescriptor,
  validResource,
  resourceName,
  metadataURL,
  HEX,
  UUID,
  type Entry,
  type Descriptor,
  type RecordBody,
  type Stored,
  type Snapshot,
  type Reservation,
  type Completion,
  type Selection,
  type Attempt,
  type Finish,
} from './schema';
import { routeRequest } from './policy';

export interface GenerationHost {
  origin: string;
  caches: CacheStorage;
  locks?: LockManager;
  fetch: (request: Request) => Promise<Response>;
  windows: () => Promise<readonly { id: string; url: string; visibilityState?: string }[]>;
  busy: () => boolean;
  online: () => boolean;
  repairDeadline?: number;
}
export interface WorkerInventory extends Entry {
  worker: string;
  implementation: string;
  compatibility: string;
}
export interface StaticStatus {
  prepared?: boolean;
  ready: boolean;
  pending: boolean;
  worker: string;
  generation: string | null;
  repair: 'idle' | 'complete' | 'failed' | 'cancelled' | 'busy' | 'offline' | 'blocked';
}

// The only discovery source is META. Resource caches are addressed exclusively
// through validated reservations/completions; prefixes/iteration order are not lineage.
export class Generations {
  private initialization?: Promise<void>;
  private local = Promise.resolve();
  private selected: string | null = null;
  private selection: Stored | null = null;
  private failed = false;
  private controllers = new Map<string, AbortController>();
  readonly worker: string;
  readonly implementation: string;
  readonly compatibility: string;
  readonly entries: Entry[];
  descriptor!: Descriptor;
  constructor(
    readonly host: GenerationHost,
    inventory: WorkerInventory[],
  ) {
    if (
      !inventory.length ||
      inventory.some(
        (entry) =>
          entry.worker !== inventory[0].worker ||
          entry.implementation !== inventory[0].implementation ||
          entry.compatibility !== inventory[0].compatibility,
      ) ||
      !HEX.test(inventory[0].worker) ||
      !HEX.test(inventory[0].implementation) ||
      !HEX.test(inventory[0].compatibility)
    )
      throw new Error('Invalid build inventory');
    this.worker = inventory[0].worker;
    this.implementation = inventory[0].implementation;
    this.compatibility = inventory[0].compatibility;
    this.entries = inventory.map(({ url, key, revision, integrity, type, bytes }) => ({
      url,
      key,
      revision,
      integrity,
      type,
      bytes,
    }));
  }
  private base() {
    return { schema: 2 as const, origin: this.host.origin, compatibility: this.compatibility };
  }
  private async run<T>(operation: () => Promise<T>, shared = false): Promise<T> {
    if (this.host.locks)
      return this.host.locks.request(LOCK, { mode: shared ? 'shared' : 'exclusive' }, operation);
    const pending = this.local.then(operation);
    this.local = pending.then(
      () => {},
      () => {},
    );
    return pending;
  }
  async initialize(): Promise<void> {
    return (this.initialization ??= this.run(async () => {
      try {
        if (
          (await digest(
            canonical({
              entries: this.entries,
              compatibility: this.compatibility,
              implementation: this.implementation,
            }),
          )) !== this.worker
        )
          throw new Error('Worker identity binding');
        const generation = await digest(
          canonical({ entries: this.entries, compatibility: this.compatibility }),
        );
        this.descriptor = await validateDescriptor(
          { ...this.base(), scope: '/', generation, entries: this.entries },
          this.host.origin,
          this.compatibility,
        );
        const snapshot = await this.snapshot();
        if (snapshot.head && (snapshot.head.body as Selection).worker !== this.worker) {
          this.failed = true;
          return;
        }
        this.selection = snapshot.head;
        this.selected = snapshot.head ? (snapshot.head.body as Selection).selected : null;
      } catch {
        this.failed = true;
      }
    }));
  }
  private async put(body: RecordBody): Promise<string> {
    await validateBody(body, this.host.origin, this.compatibility);
    const id = await digest(canonical(body));
    const cache = await this.host.caches.open(META);
    await cache.put(
      metadataURL(this.host.origin, id),
      new Response(canonical({ id, body }), { headers: { 'content-type': 'application/json' } }),
    );
    return id;
  }
  async snapshot(): Promise<Snapshot> {
    const records = new Map<string, RecordBody>();
    if (!(await this.host.caches.has(META))) return { records, chain: [], head: null };
    const cache = await this.host.caches.open(META);
    const requests = await cache.keys();
    if (requests.length > 1024) throw new Error('Metadata limit');
    for (const request of requests) {
      const response = await cache.match(request);
      if (!response || response.headers.get('content-type') !== 'application/json')
        throw new Error('Invalid metadata response');
      const raw: unknown = JSON.parse(
        new TextDecoder().decode(await boundedBytes(response, 64 * 1024)),
      );
      if (
        !raw ||
        typeof raw !== 'object' ||
        Object.keys(raw).sort().join() !== 'body,id' ||
        !('id' in raw) ||
        !('body' in raw) ||
        typeof raw.id !== 'string' ||
        !HEX.test(raw.id) ||
        request.url !== metadataURL(this.host.origin, raw.id) ||
        (await digest(canonical(raw.body))) !== raw.id
      )
        throw new Error('Metadata binding');
      records.set(raw.id, await validateBody(raw.body, this.host.origin, this.compatibility));
    }
    const referenced = new Set<string>();
    const selections: Stored[] = [];
    const requestsSeen = new Set<string>();
    const installs = new Map<string, string[]>();
    for (const [id, body] of records) {
      if (body.kind === 'reserve') {
        if (body.base && records.get(body.base)?.kind !== 'select')
          throw new Error('Reservation selection boundary');
        if (body.worker === this.worker && body.generation !== this.descriptor.generation)
          throw new Error('Worker build binding');
        if (body.previous) {
          const previous = records.get(body.previous);
          if (
            previous?.kind !== 'reserve' ||
            previous.worker !== body.worker ||
            previous.purpose !== 'install' ||
            body.purpose !== 'install'
          )
            throw new Error('Installation lineage');
        }
        if (body.purpose === 'repair') {
          const attempt = body.attempt && records.get(body.attempt);
          if (
            !attempt ||
            attempt.kind !== 'attempt' ||
            attempt.worker !== body.worker ||
            attempt.instance !== body.instance ||
            attempt.generation !== body.generation ||
            attempt.base !== body.base
          )
            throw new Error('Repair reservation');
        } else {
          if (body.attempt !== null) throw new Error('Invalid install');
          const list = installs.get(body.worker) ?? [];
          list.push(id);
          installs.set(body.worker, list);
        }
      }
      if (body.kind === 'complete') {
        const r = records.get(body.reservation);
        if (r?.kind !== 'reserve' || r.generation !== body.descriptor.generation)
          throw new Error('Completion binding');
        if (
          (await digest(
            canonical({
              entries: body.descriptor.entries,
              compatibility: body.compatibility,
              implementation: r.implementation,
            }),
          )) !== r.worker
        )
          throw new Error('Completion worker binding');
      }
      if (body.kind === 'select') {
        if (body.reason === 'activate') {
          const installation = body.installation && records.get(body.installation);
          if (
            !installation ||
            installation.kind !== 'reserve' ||
            installation.purpose !== 'install' ||
            installation.worker !== body.worker ||
            installation.base !== body.parent
          )
            throw new Error('Activation boundary');
        } else if (body.installation !== null) throw new Error('Unexpected installation');
        selections.push({ id, body });
        if (body.parent) {
          const parent = records.get(body.parent);
          if (parent?.kind !== 'select' || body.sequence !== parent.sequence + 1)
            throw new Error('Selection lineage');
          referenced.add(body.parent);
          if (
            body.reason !== 'activate' &&
            (parent.worker !== body.worker || parent.era !== body.era)
          )
            throw new Error('Stale owner');
        } else if (body.sequence !== 0 || body.reason !== 'activate')
          throw new Error('Invalid root');
        for (const ref of [body.selected, body.fallback])
          if (ref && records.get(ref)?.kind !== 'complete') throw new Error('Missing completion');
        if (body.selected && body.selected === body.fallback) throw new Error('Duplicate fallback');
      }
      if (body.kind === 'attempt') {
        if (requestsSeen.has(body.request) || records.get(body.base)?.kind !== 'select')
          throw new Error('Attempt boundary');
        requestsSeen.add(body.request);
        if (body.source && records.get(body.source)?.kind !== 'complete')
          throw new Error('Invalid repair source');
        const base = records.get(body.base) as Selection;
        if (base.worker !== body.worker || base.era !== body.era)
          throw new Error('Attempt ownership');
      }
      if (body.kind === 'finish') {
        const attempt = records.get(body.attempt);
        if (attempt?.kind !== 'attempt') throw new Error('Missing attempt');
        if (body.completion) {
          const c = records.get(body.completion);
          const r = c?.kind === 'complete' ? records.get(c.reservation) : undefined;
          if (
            c?.kind !== 'complete' ||
            r?.kind !== 'reserve' ||
            r.attempt !== body.attempt ||
            r.generation !== attempt.generation
          )
            throw new Error('Repair completion binding');
        }
      }
    }
    for (const list of installs.values()) {
      const used = new Set(list.map((id) => (records.get(id) as Reservation).previous));
      if (list.filter((id) => !used.has(id)).length !== 1)
        throw new Error('Ambiguous installation');
    }
    const tips = selections.filter((record) => !referenced.has(record.id));
    if (selections.length && tips.length !== 1) throw new Error('Ambiguous selection');
    const chain: Stored[] = [];
    let cursor: Stored | null = tips[0] ?? null;
    const seen = new Set<string>();
    while (cursor) {
      if (seen.has(cursor.id)) throw new Error('Cycle');
      seen.add(cursor.id);
      chain.unshift(cursor);
      const parent: string | null = (cursor.body as Selection).parent;
      cursor = parent ? { id: parent, body: records.get(parent)! } : null;
    }
    if (chain.length !== selections.length) throw new Error('Disconnected selection');
    const eligible = new Set<string>();
    const finishedAttempts = new Set<string>();
    for (const body of records.values())
      if (body.kind === 'finish') {
        if (finishedAttempts.has(body.attempt)) throw new Error('Contradictory repair outcome');
        finishedAttempts.add(body.attempt);
      }
    const instances = new Set<string>();
    for (const body of records.values())
      if (body.kind === 'reserve') {
        if (instances.has(body.instance)) throw new Error('Conflicting ownership');
        instances.add(body.instance);
      }
    for (const record of chain) {
      const body = record.body as Selection;
      if (body.fallback && !eligible.has(body.fallback)) throw new Error('Never-selected fallback');
      if (body.selected) {
        const completion = records.get(body.selected) as Completion;
        const reservation = records.get(completion.reservation) as Reservation;
        if (!eligible.has(body.selected)) {
          if (reservation.worker !== body.worker) throw new Error('Selection producer mismatch');
          if (body.reason === 'activate' && reservation.purpose !== 'install')
            throw new Error('Unselected staging');
          if (
            body.reason === 'repair' &&
            ![...records.values()].some(
              (r) =>
                r.kind === 'finish' &&
                r.outcome === 'complete' &&
                r.completion === body.selected &&
                (records.get(r.attempt) as Attempt).base === body.parent,
            )
          )
            throw new Error('Uncommitted repair');
          if (body.reason === 'recover') throw new Error('Unknown rollback');
        }
        eligible.add(body.selected);
      }
    }
    return { records, chain, head: tips[0] ?? null };
  }
  private completion(
    snapshot: Snapshot,
    id: string,
  ): { completion: Completion; reservation: Reservation } {
    const completion = snapshot.records.get(id);
    if (completion?.kind !== 'complete') throw new Error('Unknown completion');
    const reservation = snapshot.records.get(completion.reservation);
    if (reservation?.kind !== 'reserve') throw new Error('Unknown owner');
    return { completion, reservation };
  }
  async verify(snapshot: Snapshot, id: string | null): Promise<boolean> {
    if (!id) return false;
    try {
      const { completion, reservation } = this.completion(snapshot, id);
      const name = resourceName(reservation);
      if (!(await this.host.caches.has(name))) return false;
      const cache = await this.host.caches.open(name);
      const expected = completion.descriptor.entries;
      const actual = await cache.keys();
      if (
        actual.length !== expected.length ||
        actual.some((r) => !expected.some((e) => r.url === this.host.origin + e.key))
      )
        return false;
      for (const entry of expected) {
        const response = await cache.match(this.host.origin + entry.key);
        if (!response || !(await validResource(entry, response, this.host.origin))) return false;
      }
      return true;
    } catch {
      return false;
    }
  }
  private async fill(
    descriptor: Descriptor,
    reservation: Reservation,
    signal?: AbortSignal,
    source?: { snapshot: Snapshot; id: string },
  ) {
    const target = await this.host.caches.open(resourceName(reservation));
    const sourceCache = source
      ? await this.host.caches.open(
          resourceName(this.completion(source.snapshot, source.id).reservation),
        )
      : null;
    for (const entry of descriptor.entries) {
      signal?.throwIfAborted();
      let response = await sourceCache?.match(this.host.origin + entry.key);
      if (!response || !(await validResource(entry, response, this.host.origin)))
        response = await this.host.fetch(
          new Request(this.host.origin + entry.url, {
            credentials: 'omit',
            redirect: 'error',
            cache: 'reload',
            integrity: entry.integrity,
            signal,
          }),
        );
      signal?.throwIfAborted();
      if (response.url && response.url !== this.host.origin + entry.url)
        throw new Error('Unexpected response URL');
      if (!(await validResource(entry, response, this.host.origin)))
        throw new Error('Invalid static resource');
      await target.put(this.host.origin + entry.key, response);
    }
  }
  private async complete(reservation: string, descriptor: Descriptor) {
    const body: Completion = { ...this.base(), kind: 'complete', reservation, descriptor };
    const id = await digest(canonical(body));
    const snapshot = await this.snapshot();
    snapshot.records.set(id, body);
    if (!(await this.verify(snapshot, id))) throw new Error('Incomplete resources');
    return this.put(body);
  }
  async install() {
    await this.initialize();
    const { reservation, ref } = await this.run(async () => {
      const snapshot = await this.snapshot();
      const previous = [...snapshot.records].filter(
        ([, r]) => r.kind === 'reserve' && r.worker === this.worker && r.purpose === 'install',
      );
      const parents = new Set(previous.map(([, r]) => (r as Reservation).previous));
      const tip = previous.find(([id]) => !parents.has(id));
      const reservation: Reservation = {
        ...this.base(),
        kind: 'reserve',
        worker: this.worker,
        implementation: this.implementation,
        instance: crypto.randomUUID(),
        generation: this.descriptor.generation,
        purpose: 'install',
        previous: tip?.[0] ?? null,
        base: snapshot.head?.id ?? null,
        attempt: null,
      };
      return { reservation, ref: await this.put(reservation) };
    });
    // The immutable reservation protects these resources across workers. Do not
    // hold the selection lock over network I/O and block the old offline shell.
    await this.fill(this.descriptor, reservation);
    await this.run(async () => {
      const id = await this.complete(ref, this.descriptor);
      if (!(await this.verify(await this.snapshot(), id)))
        throw new Error('Incomplete installation');
    });
  }
  private candidate(snapshot: Snapshot): string | null {
    const installations = [...snapshot.records].filter(
      ([, r]) => r.kind === 'reserve' && r.worker === this.worker && r.purpose === 'install',
    );
    const parents = new Set(installations.map(([, r]) => (r as Reservation).previous));
    const tip = installations.find(([id]) => !parents.has(id));
    const matches = [...snapshot.records].filter(
      ([, r]) => r.kind === 'complete' && r.reservation === tip?.[0],
    );
    if (matches.length > 1) throw new Error('Ambiguous completion');
    return matches[0]?.[0] ?? null;
  }
  private async commit(
    snapshot: Snapshot,
    selected: string | null,
    fallback: string | null,
    reason: 'activate' | 'repair' | 'recover',
    era: string,
    installation: string | null = null,
  ) {
    const body: Selection = {
      ...this.base(),
      kind: 'select',
      parent: snapshot.head?.id ?? null,
      sequence: snapshot.head ? (snapshot.head.body as Selection).sequence + 1 : 0,
      worker: this.worker,
      era,
      selected,
      fallback,
      reason,
      installation,
    };
    const id = await this.put(body);
    this.selection = { id, body };
    this.selected = selected;
    this.failed = false;
  }
  async activate() {
    await this.initialize();
    return this.run(async () => {
      const snapshot = await this.snapshot();
      const previous = snapshot.head?.body as Selection | undefined;
      const own = this.candidate(snapshot);
      const reservation = own ? this.completion(snapshot, own).reservation : null;
      const installation = own ? (snapshot.records.get(own) as Completion).reservation : null;
      // An activation ticket is bound to the selection observed at reservation.
      // A stale worker cannot append over a newer era; a genuine rollback has a
      // newly reserved installation bound to that newer era.
      if (!reservation || reservation.base !== (snapshot.head?.id ?? null)) {
        if (previous?.worker === this.worker && previous.installation === installation) return;
        throw new Error('Stale activation');
      }
      let selected = previous?.selected ?? null;
      let fallback = previous?.fallback ?? null;
      if (await this.verify(snapshot, own)) {
        selected = own;
        fallback = (await this.verify(snapshot, previous?.selected ?? null))
          ? previous!.selected
          : (await this.verify(snapshot, previous?.fallback ?? null))
            ? previous!.fallback
            : null;
      } else if (
        !(await this.verify(snapshot, selected)) &&
        (await this.verify(snapshot, fallback))
      ) {
        selected = fallback;
        fallback = null;
      }
      if (fallback === selected) fallback = null;
      await this.commit(
        snapshot,
        selected,
        fallback,
        'activate',
        crypto.randomUUID(),
        installation,
      );
    }).catch(() => {
      this.failed = true;
    });
  }
  private async promote(incoming: string) {
    if (!this.host.locks || this.host.busy()) return;
    const windows = await this.host.windows();
    if (windows.some((client) => client.id !== incoming)) return;
    const snapshot = await this.snapshot();
    if (!this.selection || snapshot.head?.id !== this.selection.id) return;
    const body = this.selection.body as Selection;
    const finished = [...snapshot.records].filter(
      ([, r]) =>
        r.kind === 'finish' &&
        r.outcome === 'complete' &&
        r.completion &&
        (snapshot.records.get(r.attempt) as Attempt)?.base === snapshot.head!.id,
    );
    // Multiple explicit repairs must never create an ordering based on enumeration.
    // Select only the single committed successful result for this base selection.
    if (finished.length === 0) {
      if (
        !(await this.verify(snapshot, body.selected)) &&
        (await this.verify(snapshot, body.fallback))
      )
        await this.commit(snapshot, body.fallback, null, 'recover', body.era);
      return;
    }
    if (finished.length !== 1) return;
    const complete = (finished[0][1] as Finish).completion!;
    if (!(await this.verify(snapshot, complete))) return;
    const fallback = (await this.verify(snapshot, body.selected))
      ? body.selected
      : (await this.verify(snapshot, body.fallback))
        ? body.fallback
        : null;
    await this.commit(snapshot, complete, fallback, 'repair', body.era);
  }
  async status(): Promise<StaticStatus> {
    await this.initialize();
    return this.run(async () => {
      try {
        const snapshot = await this.snapshot();
        if (this.failed)
          return {
            ...this.statusValue(false, false),
            prepared: await this.verify(snapshot, this.candidate(snapshot)),
          };
        if (snapshot.head?.id !== this.selection?.id) return this.statusValue(false, false);
        const ready = await this.verify(snapshot, this.selected);
        const selected = this.selected
          ? this.completion(snapshot, this.selected).completion.descriptor.generation
          : null;
        return {
          ...this.statusValue(ready, selected !== this.descriptor.generation),
          generation: selected,
          prepared: await this.verify(snapshot, this.candidate(snapshot)),
        };
      } catch {
        return this.statusValue(false, false);
      }
    }, true);
  }
  private statusValue(ready: boolean, pending: boolean): StaticStatus {
    return { ready, pending, worker: this.worker, generation: this.selected, repair: 'idle' };
  }
  async respond(request: Request, incoming = '', replaces = ''): Promise<Response | undefined> {
    await this.initialize();
    const preliminary = routeRequest(
      request,
      this.host.origin,
      new Set(this.entries.map((e) => this.host.origin + e.url)),
    );
    if (preliminary === 'network' && !new URL(request.url).pathname.startsWith('/assets/')) return;
    if (
      request.mode === 'navigate' &&
      !replaces &&
      new URL(request.url).pathname === '/' &&
      !new URL(request.url).search
    )
      await this.run(() => this.promote(incoming)).catch(() => {});
    return this.run(async () => {
      if (this.failed || !this.selected)
        return preliminary === 'network' ? undefined : Response.error();
      try {
        const snapshot = await this.snapshot();
        if (snapshot.head?.id !== this.selection?.id) return Response.error();
        const { completion, reservation } = this.completion(snapshot, this.selected);
        const kind = routeRequest(
          request,
          this.host.origin,
          new Set(completion.descriptor.entries.map((e) => this.host.origin + e.url)),
        );
        if (kind === 'network') return;
        if (
          (kind === 'shell' || kind === 'callback') &&
          !(await this.verify(snapshot, this.selected))
        )
          return Response.error();
        const path = kind === 'static' ? new URL(request.url).pathname : '/';
        const entry = completion.descriptor.entries.find((e) => e.url === path)!;
        const response = await (
          await this.host.caches.open(resourceName(reservation))
        ).match(this.host.origin + entry.key);
        if (!response || !(await validResource(entry, response, this.host.origin)))
          return Response.error();
        if (kind !== 'callback') return response;
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'no-store');
        headers.set('Referrer-Policy', 'no-referrer');
        return new Response(response.body, { status: 200, headers });
      } catch {
        return Response.error();
      }
    }, true);
  }
  cancel(request: string) {
    this.controllers.get(request)?.abort();
  }
  async repair(request: string, blocked = false): Promise<StaticStatus> {
    await this.initialize();
    if (blocked || !UUID.test(request) || !this.host.locks)
      return { ...(await this.status()), repair: 'blocked' };
    if (!this.host.online()) return { ...(await this.status()), repair: 'offline' };
    return this.host.locks.request(LOCK + '-repair', { ifAvailable: true }, async (lock) => {
      if (!lock) return { ...this.statusValue(false, true), repair: 'busy' };
      let attemptId: string | null = null;
      let controller: AbortController | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const setup = await this.run(async () => {
          const snapshot = await this.snapshot();
          if (this.failed || !this.selection || snapshot.head?.id !== this.selection.id)
            throw new Error('Stale worker');
          if (
            [...snapshot.records.values()].some(
              (r) => r.kind === 'attempt' && r.request === request,
            )
          )
            throw new Error('Spent attempt');
          if (
            [...snapshot.records.values()].some(
              (r) =>
                r.kind === 'finish' &&
                r.outcome === 'complete' &&
                (snapshot.records.get(r.attempt) as Attempt)?.base === this.selection!.id,
            )
          )
            return null;
          const current = this.selection.body as Selection;
          const instance = crypto.randomUUID();
          const source = this.candidate(snapshot);
          const attempt: Attempt = {
            ...this.base(),
            kind: 'attempt',
            request,
            base: this.selection.id,
            worker: this.worker,
            era: current.era,
            generation: this.descriptor.generation,
            instance,
            source,
          };
          attemptId = await this.put(attempt);
          controller = new AbortController();
          this.controllers.set(request, controller);
          timer = setTimeout(() => controller!.abort(), this.host.repairDeadline ?? 12000);
          const reservation: Reservation = {
            ...this.base(),
            kind: 'reserve',
            worker: this.worker,
            implementation: this.implementation,
            instance,
            generation: this.descriptor.generation,
            purpose: 'repair',
            previous: null,
            base: attempt.base,
            attempt: attemptId,
          };
          return { snapshot, source, reservation, reserved: await this.put(reservation) };
        });
        if (!setup) return { ...this.statusValue(true, true), repair: 'complete' };
        await this.fill(
          this.descriptor,
          setup.reservation,
          controller!.signal,
          setup.source ? { snapshot: setup.snapshot, id: setup.source } : undefined,
        );
        await this.run(async () => {
          controller!.signal.throwIfAborted();
          const complete = await this.complete(setup.reserved, this.descriptor);
          controller!.signal.throwIfAborted();
          await this.put({
            ...this.base(),
            kind: 'finish',
            attempt: attemptId!,
            outcome: 'complete',
            completion: complete,
          });
        });
        return {
          ...this.statusValue(await this.verify(await this.snapshot(), this.selected), true),
          repair: 'complete',
        };
      } catch {
        if (attemptId)
          await this.run(() =>
            this.put({
              ...this.base(),
              kind: 'finish',
              attempt: attemptId!,
              outcome: controller?.signal.aborted ? 'cancelled' : 'failed',
              completion: null,
            }),
          ).catch(() => {});
        return {
          ...this.statusValue(false, true),
          repair: controller?.signal.aborted ? 'cancelled' : 'failed',
        };
      } finally {
        if (timer) clearTimeout(timer);
        this.controllers.delete(request);
      }
    });
  }
  async cleanup(): Promise<boolean> {
    await this.initialize();
    if (!this.host.locks) return false;
    return this.run(async () => {
      try {
        if (this.failed || this.host.busy() || (await this.host.windows()).length) return false;
        const snapshot = await this.snapshot();
        if (!this.selection || snapshot.head?.id !== this.selection.id) return false;
        const head = this.selection.body as Selection;
        if (
          !head.selected ||
          !head.fallback ||
          !(await this.verify(snapshot, head.selected)) ||
          !(await this.verify(snapshot, head.fallback))
        )
          return false;
        const retained = new Set([head.selected, head.fallback]);
        const ever = new Set(
          snapshot.chain.flatMap((s) =>
            (s.body as Selection).selected ? [(s.body as Selection).selected!] : [],
          ),
        );
        // Unselected installs, staging and interrupted work remain reserved. Only
        // historical selected generations outside the retained pair are eligible.
        const finished = new Set(
          [...snapshot.records.values()]
            .filter((r) => r.kind === 'finish')
            .map((r) => (r as Finish).attempt),
        );
        for (const [id, record] of snapshot.records)
          if (record.kind === 'attempt' && !finished.has(id) && record.source)
            retained.add(record.source);
        const candidates = [...ever].filter((id) => !retained.has(id));
        if ((await this.host.windows()).length || this.host.busy()) return false;
        for (const id of candidates) {
          const { reservation } = this.completion(snapshot, id);
          if (
            [...retained].some(
              (ref) => this.completion(snapshot, ref).reservation.instance === reservation.instance,
            )
          )
            continue;
          await this.host.caches.delete(resourceName(reservation));
        }
        return true;
      } catch {
        return false;
      }
    });
  }
}
