import { describe, expect, it } from 'vitest';
import { httpsDnsOrigin, supabaseOrigin } from './origin';
import { unsafeOrigins } from '../../test/unsafeOrigins';

describe('raw DNS origin validation', () => {
  it.each(unsafeOrigins)('rejects unsafe spelling %j before normalization', (value) => {
    expect(() => httpsDnsOrigin(value)).toThrow();
    expect(() => supabaseOrigin(value, true)).toThrow();
  });
  it.each([
    'https://synthetic-project.supabase.co',
    'https://auth.example.test',
    'https://xn--bcher-kva.example',
  ])('accepts concrete HTTPS DNS %s', (value) => {
    expect(httpsDnsOrigin(value)).toBe(value);
    expect(httpsDnsOrigin(`${value}:443/`)).toBe(value);
  });
  it('enforces label and total-length boundaries', () => {
    const host = ['a'.repeat(63), 'b'.repeat(63), 'c'.repeat(63), 'd'.repeat(61)].join('.');
    expect(host.length).toBe(253);
    expect(httpsDnsOrigin(`https://${host}`)).toBe(`https://${host}`);
  });
  it.each(['localhost', '127.0.0.1', '[::1]'])(
    'allows only the local backend port for %s in a local artifact',
    (host) => {
      expect(supabaseOrigin(`http://${host}:54321/`, true)).toBe(`http://${host}:54321`);
      expect(() => supabaseOrigin(`http://${host}:54321`)).toThrow();
      expect(() => supabaseOrigin(`http://${host}:54322`, true)).toThrow();
    },
  );
});
