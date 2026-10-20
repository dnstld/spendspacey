import {
  META,
  canonical,
  digest,
  boundedBytes,
  validateBody,
  metadataURL,
  HEX,
  type RecordBody,
  type Stored,
  type Snapshot,
  type Reservation,
  type Completion,
  type Selection,
  type Attempt,
} from './legacy-schema';
// Read-only validator for the actual 069dbc50 schema. No legacy mutation or inference.
export async function legacySnapshot(
  caches: CacheStorage,
  origin: string,
  compatibility: string,
): Promise<Snapshot> {
  const records = new Map<string, RecordBody>();
  if (!(await caches.has(META))) return { records, chain: [], head: null };
  const cache = await caches.open(META);
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
      request.url !== metadataURL(origin, raw.id) ||
      (await digest(canonical(raw.body))) !== raw.id
    )
      throw new Error('Metadata binding');
    records.set(raw.id, await validateBody(raw.body, origin, compatibility));
  }
  const referenced = new Set<string>();
  const selections: Stored[] = [];
  const requestsSeen = new Set<string>();
  const installs = new Map<string, string[]>();
  for (const [id, body] of records) {
    if (body.kind === 'reserve') {
      if (body.base && records.get(body.base)?.kind !== 'select')
        throw new Error('Reservation selection boundary');
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
      } else if (body.sequence !== 0 || body.reason !== 'activate') throw new Error('Invalid root');
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
    if (list.filter((id) => !used.has(id)).length !== 1) throw new Error('Ambiguous installation');
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
