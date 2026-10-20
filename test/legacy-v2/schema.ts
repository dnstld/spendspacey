// Frozen 069dbc50 implementation: test-only cutover evidence, never bundled.
import { staticPath, mimeFor } from './policy.ts';

export const META = 'spendspacey-static-meta-v2';
export const RESOURCE_PREFIX = 'spendspacey-static-resource-v2-';
export const META_PATH = '/__spendspacey_static_v2__/';
export const LOCK = 'spendspacey-static-v2';
export const HEX = /^[a-f0-9]{64}$/;
export const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export interface Entry {
  url: string;
  key: string;
  revision: string | null;
  integrity: string;
  type: string;
  bytes: number;
}
export interface Descriptor {
  schema: 2;
  origin: string;
  scope: '/';
  compatibility: string;
  generation: string;
  entries: Entry[];
}
interface Base {
  schema: 2;
  origin: string;
  compatibility: string;
}
export type Reservation = Base & {
  kind: 'reserve';
  worker: string;
  implementation: string;
  instance: string;
  generation: string;
  purpose: 'install' | 'repair';
  previous: string | null;
  base: string | null;
  attempt: string | null;
};
export type Completion = Base & { kind: 'complete'; reservation: string; descriptor: Descriptor };
export type Selection = Base & {
  kind: 'select';
  parent: string | null;
  sequence: number;
  worker: string;
  era: string;
  selected: string | null;
  fallback: string | null;
  reason: 'activate' | 'repair' | 'recover';
  installation: string | null;
};
export type Attempt = Base & {
  kind: 'attempt';
  source: string | null;
  request: string;
  base: string;
  worker: string;
  era: string;
  generation: string;
  instance: string;
};
export type Finish = Base & {
  kind: 'finish';
  attempt: string;
  outcome: 'complete' | 'failed' | 'cancelled';
  completion: string | null;
};
export type RecordBody = Reservation | Completion | Selection | Attempt | Finish;
export interface Stored {
  id: string;
  body: RecordBody;
}
export interface Snapshot {
  records: Map<string, RecordBody>;
  chain: Stored[];
  head: Stored | null;
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map(
          (key) => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key]),
        )
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export async function digest(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
export async function generation(entries: Entry[], compatibility: string) {
  return digest(canonical({ entries, compatibility }));
}
export async function boundedBytes(response: Response, max: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new Error('Oversized response');
      parts.push(value);
    }
  } finally {
    // A cloned response is a tee: waiting for cancellation can wait forever for
    // the untouched branch. Cancel promptly without blocking validation failure.
    void reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
export function keys(value: unknown, expected: string[]): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== expected.sort().join()
  )
    throw new Error('Invalid record structure');
}
function id(value: unknown, nullable = false) {
  if (!(nullable && value === null) && !(typeof value === 'string' && HEX.test(value)))
    throw new Error('Invalid identity');
}
function uuid(value: unknown) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error('Invalid instance');
}
export async function validateDescriptor(
  value: unknown,
  origin: string,
  compatibility: string,
): Promise<Descriptor> {
  keys(value, ['schema', 'origin', 'scope', 'compatibility', 'generation', 'entries']);
  if (
    value.schema !== 2 ||
    value.origin !== origin ||
    value.scope !== '/' ||
    value.compatibility !== compatibility
  )
    throw new Error('Incompatible descriptor');
  id(value.generation);
  if (!Array.isArray(value.entries) || value.entries.length < 11 || value.entries.length > 128)
    throw new Error('Invalid inventory');
  let previous = '';
  let total = 0;
  for (const entry of value.entries) {
    keys(entry, ['url', 'key', 'revision', 'integrity', 'type', 'bytes']);
    if (
      typeof entry.url !== 'string' ||
      !staticPath(entry.url) ||
      entry.url <= previous ||
      entry.key !== entry.url ||
      entry.type !== mimeFor(entry.url)
    )
      throw new Error('Invalid static mapping');
    if (
      !(
        entry.revision === null ||
        (typeof entry.revision === 'string' && /^[a-f0-9]{32}$/.test(entry.revision))
      ) ||
      typeof entry.integrity !== 'string' ||
      !/^sha256-[A-Za-z0-9+/]{43}=$/.test(entry.integrity) ||
      !Number.isSafeInteger(entry.bytes) ||
      Number(entry.bytes) < 1 ||
      Number(entry.bytes) > 2 * 1024 * 1024
    )
      throw new Error('Invalid static expectation');
    previous = entry.url;
    total += Number(entry.bytes);
  }
  const urls = value.entries.map((entry) => entry.url as string);
  for (const required of [
    '/',
    '/manifest.webmanifest',
    '/google-g.png',
    '/fonts/google-sans-medium.woff2',
    '/icons/app-192.png',
    '/icons/app-512.png',
    '/icons/maskable-512.png',
    '/icons/apple-touch-icon.png',
  ])
    if (!urls.includes(required)) throw new Error('Incomplete inventory');
  if (
    total > 8 * 1024 * 1024 ||
    !urls.some((url) => /^\/assets\/index-.*\.js$/.test(url)) ||
    !urls.some((url) => /^\/assets\/supabase-.*\.js$/.test(url)) ||
    !urls.some((url) => url.endsWith('.css'))
  )
    throw new Error('Missing chunks');
  if ((await generation(value.entries as unknown as Entry[], compatibility)) !== value.generation)
    throw new Error('Generation binding failed');
  return value as unknown as Descriptor;
}
export async function validateBody(
  input: unknown,
  origin: string,
  compatibility: string,
): Promise<RecordBody> {
  if (!input || typeof input !== 'object' || !('kind' in input))
    throw new Error('Invalid metadata');
  const body = input as Record<string, unknown>;
  const fields: Record<string, string[]> = {
    reserve: [
      'worker',
      'implementation',
      'instance',
      'generation',
      'purpose',
      'previous',
      'base',
      'attempt',
    ],
    complete: ['reservation', 'descriptor'],
    select: [
      'parent',
      'sequence',
      'worker',
      'era',
      'selected',
      'fallback',
      'reason',
      'installation',
    ],
    attempt: ['request', 'base', 'worker', 'era', 'generation', 'instance', 'source'],
    finish: ['attempt', 'outcome', 'completion'],
  };
  const kind = String(body.kind);
  if (!(kind in fields)) throw new Error('Unsupported metadata');
  keys(body, ['schema', 'origin', 'compatibility', 'kind', ...fields[kind]]);
  if (body.schema !== 2 || body.origin !== origin || body.compatibility !== compatibility)
    throw new Error('Incompatible metadata');
  if ('worker' in body) id(body.worker);
  if ('implementation' in body) id(body.implementation);
  if ('instance' in body) uuid(body.instance);
  if ('generation' in body) id(body.generation);
  if ('era' in body) uuid(body.era);
  if (kind === 'reserve') {
    id(body.previous, true);
    id(body.base, true);
    id(body.attempt, true);
    if (!['install', 'repair'].includes(String(body.purpose)))
      throw new Error('Invalid reservation');
  }
  if (kind === 'complete') {
    id(body.reservation);
    await validateDescriptor(body.descriptor, origin, compatibility);
  }
  if (kind === 'select') {
    id(body.parent, true);
    id(body.installation, true);
    id(body.selected, true);
    id(body.fallback, true);
    if (
      !Number.isSafeInteger(body.sequence) ||
      Number(body.sequence) < 0 ||
      !['activate', 'repair', 'recover'].includes(String(body.reason))
    )
      throw new Error('Invalid selection');
  }
  if (kind === 'attempt') {
    uuid(body.request);
    id(body.base);
    id(body.source, true);
  }
  if (kind === 'finish') {
    id(body.attempt);
    id(body.completion, true);
    if (
      !['complete', 'failed', 'cancelled'].includes(String(body.outcome)) ||
      (body.outcome === 'complete') !== (body.completion !== null)
    )
      throw new Error('Invalid outcome');
  }
  return body as unknown as RecordBody;
}
export function resourceName(reservation: Reservation) {
  return RESOURCE_PREFIX + reservation.instance;
}
export function metadataURL(origin: string, id: string) {
  return origin + META_PATH + id;
}
export async function validResource(
  entry: Entry,
  response: Response,
  origin: string,
): Promise<boolean> {
  if (
    response.status !== 200 ||
    response.redirected ||
    (response.url !== '' && response.url !== origin + entry.url) ||
    ['opaque', 'opaqueredirect', 'error'].includes(response.type) ||
    response.headers.get('content-type')?.split(';')[0].trim() !== entry.type
  )
    return false;
  try {
    const bytes = await boundedBytes(response.clone(), entry.bytes);
    const hash = await digest(bytes);
    return (
      bytes.length === entry.bytes &&
      'sha256-' +
        btoa(String.fromCharCode(...hash.match(/../g)!.map((byte) => parseInt(byte, 16)))) ===
        entry.integrity
    );
  } catch {
    return false;
  }
}
