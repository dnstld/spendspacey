import { keys, HEX, UUID, validateDescriptor, type Descriptor } from './legacy-schema.ts';
export {
  canonical,
  digest,
  boundedBytes,
  validResource,
  generation,
  HEX,
  UUID,
  type Entry,
  type Descriptor,
} from './legacy-schema.ts';
export const META = 'spendspacey-static-ownership-v3';
export const META_PATH = '/__spendspacey_ownership_v3__/';
export const RESOURCE_PREFIX = 'spendspacey-static-resource-v3-';
// Coordinate with the previous implementation while copying its immutable resources.
export const LOCK = 'spendspacey-static-v2';
export const PROTOCOL = 3;
export type Outcome = 'complete' | 'failed' | 'timed-out' | 'cancelled';
export type Op =
  | {
      kind: 'reserve';
      instance: string;
      purpose: 'install' | 'repair' | 'import';
      generation: string;
      source: string | null;
      attempt: string | null;
      descriptor: Descriptor;
      producer: string;
      implementation: string;
      legacy: boolean;
    }
  | { kind: 'complete'; reservation: string }
  | {
      kind: 'activate';
      installation: string;
      selected: string | null;
      fallback: string | null;
      nextEpoch: string;
    }
  | {
      kind: 'navigation';
      navigation: string;
      client: string;
      mode: 'shell' | 'callback';
      references: string[];
    }
  | {
      kind: 'deliver';
      reservation: string;
      client: string;
      generation: string | null;
      recovery: boolean;
      selection: string | null;
      selected: string | null;
      fallback: string | null;
      adoption: string | null;
      recoveryRequest: string | null;
    }
  | { kind: 'recovery-request'; binding: string; request: string }
  | { kind: 'cancel'; binding: string; request: string; attempt: string }
  | { kind: 'confirm'; binding: string; request: string }
  | { kind: 'evidence'; binding: string; result: 'handled' | 'handling-error' }
  | { kind: 'abandon'; reservation: string; outcome: 'delivery-failed' | 'abandoned' }
  | {
      kind: 'attempt';
      request: string;
      binding: string;
      source: string | null;
      base: string;
      instance: string;
    }
  | { kind: 'finish'; attempt: string; outcome: Outcome; completion: string | null }
  | {
      kind: 'cutover';
      legacyHead: string | null;
      legacyDigest: string;
      attempts: { request: string; outcome: Outcome | 'unknown' }[];
      protected: string[];
      eligible: string[];
    }
  | {
      kind: 'legacy-update';
      cutover: string;
      legacyHead: string | null;
      legacyDigest: string;
      attempts: { request: string; outcome: Outcome | 'unknown' }[];
      protected: string[];
      eligible: string[];
    }
  | { kind: 'seal'; generations: string[] }
  | { kind: 'deleted'; seal: string };
export type RecordBody = Op & {
  schema: 3;
  origin: string;
  compatibility: string;
  worker: string;
  epoch: string | null;
  parent: string | null;
  sequence: number;
};
export interface Stored {
  id: string;
  body: RecordBody;
}
export interface Snapshot {
  records: Map<string, RecordBody>;
  chain: Stored[];
  head: Stored | null;
  selection: Stored | null;
  epoch: string | null;
  owner: string | null;
  bindings: Map<string, Stored>;
  sealed: Set<string>;
}
export const metadataURL = (origin: string, id: string) => origin + META_PATH + id;
export const resourceName = (r: { instance: string }) => RESOURCE_PREFIX + r.instance;
export function identity(value: unknown, nullable = false): asserts value is string {
  if (!(nullable && value === null) && !(typeof value === 'string' && HEX.test(value)))
    throw new Error('Invalid identity');
}
export function browserID(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
export async function validateBody(
  value: unknown,
  origin: string,
  compatibility: string,
  legacyCompatibility: string,
): Promise<RecordBody> {
  if (!value || typeof value !== 'object' || !('kind' in value))
    throw new Error('Unsupported record');
  const v = value as Record<string, unknown>;
  const fields: Record<string, string[]> = {
    reserve: [
      'instance',
      'purpose',
      'generation',
      'source',
      'attempt',
      'descriptor',
      'producer',
      'implementation',
      'legacy',
    ],
    complete: ['reservation'],
    activate: ['installation', 'selected', 'fallback', 'nextEpoch'],
    navigation: ['navigation', 'client', 'mode', 'references'],
    deliver: [
      'reservation',
      'client',
      'generation',
      'recovery',
      'selection',
      'selected',
      'fallback',
      'adoption',
      'recoveryRequest',
    ],
    'recovery-request': ['binding', 'request'],
    cancel: ['binding', 'request', 'attempt'],
    confirm: ['binding', 'request'],
    evidence: ['binding', 'result'],
    abandon: ['reservation', 'outcome'],
    attempt: ['request', 'binding', 'source', 'base', 'instance'],
    finish: ['attempt', 'outcome', 'completion'],
    cutover: ['legacyHead', 'legacyDigest', 'attempts', 'protected', 'eligible'],
    'legacy-update': ['cutover', 'legacyHead', 'legacyDigest', 'attempts', 'protected', 'eligible'],
    seal: ['generations'],
    deleted: ['seal'],
  };
  const kind = String(v.kind);
  if (!Object.hasOwn(fields, kind)) throw new Error('Unsupported record');
  keys(v, [
    'schema',
    'origin',
    'compatibility',
    'worker',
    'epoch',
    'parent',
    'sequence',
    'kind',
    ...fields[kind],
  ]);
  if (
    v.schema !== 3 ||
    v.origin !== origin ||
    v.compatibility !== compatibility ||
    !Number.isSafeInteger(v.sequence) ||
    Number(v.sequence) < 0
  )
    throw new Error('Incompatible record');
  identity(v.worker);
  identity(v.parent, true);
  if (v.epoch !== null && !(typeof v.epoch === 'string' && UUID.test(v.epoch)))
    throw new Error('Invalid epoch');
  for (const field of [
    'reservation',
    'generation',
    'source',
    'attempt',
    'installation',
    'selected',
    'fallback',
    'selection',
    'adoption',
    'binding',
    'base',
    'completion',
    'legacyHead',
    'cutover',
    'legacyDigest',
    'recoveryRequest',
    'seal',
    'producer',
    'implementation',
  ])
    if (field in v)
      identity(
        v[field],
        [
          'generation',
          'source',
          'attempt',
          'selected',
          'fallback',
          'selection',
          'adoption',
          'completion',
          'legacyHead',
          'recoveryRequest',
        ].includes(field),
      );
  for (const field of ['instance', 'navigation', 'request', 'nextEpoch'])
    if (field in v && !(typeof v[field] === 'string' && UUID.test(v[field])))
      throw new Error('Invalid operation identity');
  if ('client' in v && !browserID(v.client)) throw new Error('Invalid browser identity');
  for (const field of ['references', 'generations', 'protected', 'eligible'])
    if (field in v) {
      if (
        !Array.isArray(v[field]) ||
        (v[field] as unknown[]).length > 128 ||
        new Set(v[field] as unknown[]).size !== (v[field] as unknown[]).length
      )
        throw new Error('Invalid reference set');
      for (const ref of v[field] as unknown[]) identity(ref);
    }
  if (kind === 'reserve') {
    if (
      !['install', 'repair', 'import'].includes(String(v.purpose)) ||
      typeof v.legacy !== 'boolean'
    )
      throw new Error('Invalid resource owner');
    await validateDescriptor(v.descriptor, origin, v.legacy ? legacyCompatibility : compatibility);
    if ((v.descriptor as Descriptor).generation !== v.generation)
      throw new Error('Descriptor identity');
  }
  if (kind === 'navigation' && !['shell', 'callback'].includes(String(v.mode)))
    throw new Error('Invalid navigation');
  if (
    kind === 'deliver' &&
    (typeof v.recovery !== 'boolean' || v.recovery !== (v.generation === null))
  )
    throw new Error('Invalid delivery');
  if (kind === 'abandon' && !['delivery-failed', 'abandoned'].includes(String(v.outcome)))
    throw new Error('Invalid abandonment evidence');
  if (kind === 'evidence' && !['handled', 'handling-error'].includes(String(v.result)))
    throw new Error('Invalid evidence');
  if (
    kind === 'finish' &&
    (!['complete', 'failed', 'timed-out', 'cancelled'].includes(String(v.outcome)) ||
      (v.outcome === 'complete') !== (v.completion !== null))
  )
    throw new Error('Invalid outcome');
  if (kind === 'cutover' || kind === 'legacy-update') {
    if ((v.eligible as string[]).some((id) => !(v.protected as string[]).includes(id)))
      throw new Error('Unowned legacy eligibility');
    if (!Array.isArray(v.attempts) || v.attempts.length > 1024) throw new Error('Invalid history');
    const seen = new Set();
    for (const a of v.attempts) {
      keys(a, ['request', 'outcome']);
      if (
        typeof a.request !== 'string' ||
        !UUID.test(a.request) ||
        seen.has(a.request) ||
        !['complete', 'failed', 'timed-out', 'cancelled', 'unknown'].includes(String(a.outcome))
      )
        throw new Error('Invalid history');
      seen.add(a.request);
    }
  }
  return v as unknown as RecordBody;
}
