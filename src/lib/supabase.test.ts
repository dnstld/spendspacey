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

it('does not persist or automatically refresh a preview session', async () => {
  vi.resetModules();
  vi.stubGlobal('__PAGES_PREVIEW__', true);
  const { createClient } = await import('@supabase/supabase-js');
  const { getSupabase } = await import('./supabase');
  getSupabase({
    supabaseUrl: 'https://auth.example.test',
    supabasePublishableKey: 'sb_publishable_synthetic_phase1_only',
  });
  expect(createClient).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
});
