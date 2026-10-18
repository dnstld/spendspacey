// Validate the spelling before URL can trim, decode, normalize IPs, or apply IDNA.
export function httpsDnsOrigin(value: unknown): string {
  if (typeof value !== 'string' || /[^\x21-\x7e]/.test(value)) {
    throw new Error('Invalid HTTPS DNS origin.');
  }
  const match = /^https:\/\/([a-z0-9.-]+)(?::443)?\/?$/i.exec(value);
  if (!match) throw new Error('Invalid HTTPS DNS origin.');
  const host = match[1].toLowerCase();
  const labels = host.split('.');
  if (
    host.length > 253 ||
    labels.length < 2 ||
    !/[a-z]/.test(labels.at(-1)!) ||
    labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    throw new Error('Invalid HTTPS DNS origin.');
  const url = new URL(value);
  if (url.hostname !== host) throw new Error('Invalid HTTPS DNS origin.');
  return url.origin;
}

const localBackends = ['http://localhost:54321', 'http://127.0.0.1:54321', 'http://[::1]:54321'];

export function supabaseOrigin(value: unknown, allowLocal = false): string {
  if (typeof value === 'string' && allowLocal) {
    const root = value.endsWith('/') ? value.slice(0, -1) : value;
    if (localBackends.includes(root)) return root;
  }
  return httpsDnsOrigin(value);
}
