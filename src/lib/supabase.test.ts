import { expect, it, vi } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ auth: {} })) }));

it('creates a single PKCE client with explicit callback ownership and persistent refresh', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const { getSupabase } = await import('./supabase');
  const config = {
    supabaseUrl: 'https://auth.example.test',
    supabasePublishableKey: 'sb_publishable_synthetic_phase1_only',
  };
  expect(getSupabase(config)).toBe(getSupabase(config));
  expect(createClient).toHaveBeenCalledOnce();
  expect(createClient).toHaveBeenCalledWith(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
});

it('creates no client at a denied origin', async () => {
  vi.resetModules();
  vi.stubGlobal('__AUTH_POLICY__', { kind: 'denied' });
  const { createClient } = await import('@supabase/supabase-js');
  const { getSupabase } = await import('./supabase');
  expect(
    getSupabase({
      supabaseUrl: 'https://auth.example.test',
      supabasePublishableKey: 'sb_publishable_synthetic_phase1_only',
    }),
  ).toBeUndefined();
  expect(createClient).not.toHaveBeenCalled();
});
