import { describe, expect, it } from 'vitest';
import { parsePublicConfig } from './env';
import { SYNTHETIC_ENV } from '../../test/config';

describe('public configuration', () => {
  it('accepts exactly the public configuration and normalizes the origin', () => {
    expect(parsePublicConfig({ ...SYNTHETIC_ENV, UNUSED: 'ignored' })).toEqual({
      supabaseUrl: 'https://auth.example.test',
      supabasePublishableKey: SYNTHETIC_ENV.VITE_SUPABASE_PUBLISHABLE_KEY,
    });
  });

  it.each(['http://localhost:54321', 'http://127.0.0.1:54321', 'http://[::1]:54321'])(
    'allows loopback %s',
    (url) => {
      expect(parsePublicConfig({ ...SYNTHETIC_ENV, VITE_SUPABASE_URL: url }).supabaseUrl).toBe(url);
    },
  );

  it.each([
    undefined,
    '',
    'invalid',
    'http://auth.example.test',
    'ftp://localhost',
    'https://auth.example.test/path',
    'https://user:password@auth.example.test',
    'https://auth.example.test?secret=synthetic',
    'https://auth.example.test#synthetic',
  ])('rejects unsafe URL without echoing it: %s', (url) => {
    expect(() => parsePublicConfig({ ...SYNTHETIC_ENV, VITE_SUPABASE_URL: url })).toThrow(
      'Invalid public configuration: VITE_SUPABASE_URL',
    );
  });

  it.each([
    undefined,
    '',
    'sb_secret_synthetic_only',
    'eyJsynthetic.legacy.key',
    'sb_publishable_',
    'sb_publishable_contains space',
  ])('rejects nonpublishable input without echoing it: %s', (key) => {
    expect(() =>
      parsePublicConfig({ ...SYNTHETIC_ENV, VITE_SUPABASE_PUBLISHABLE_KEY: key }),
    ).toThrow('Invalid public configuration: VITE_SUPABASE_PUBLISHABLE_KEY');
  });

  it('reports missing variable names together', () => {
    expect(() => parsePublicConfig({})).toThrow('VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY');
  });

  it('rejects extra VITE inputs before they can be bundled without echoing their values', () => {
    expect(() =>
      parsePublicConfig({ ...SYNTHETIC_ENV, VITE_UNEXPECTED: 'synthetic-private-do-not-echo' }),
    ).toThrow('Only VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are public inputs.');
  });
});
