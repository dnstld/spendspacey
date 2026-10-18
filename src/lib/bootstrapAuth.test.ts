import { expect, it, vi } from 'vitest';
import { bootstrapAuth } from './bootstrapAuth';
import { SYNTHETIC_ENV } from '../../test/config';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ auth: {} })) }));

it.each(['denied', 'production'])(
  'scrubs denied callbacks before constructing a client (%s)',
  async (kind) => {
    vi.stubGlobal('__AUTH_POLICY__', { kind, origin: 'https://synthetic-app.pages.dev' });
    history.replaceState(null, '', '/auth/callback?code=synthetic-code#error=synthetic-error');
    const { createClient } = await import('@supabase/supabase-js');
    expect(await bootstrapAuth(SYNTHETIC_ENV)).toBeUndefined();
    expect(location.pathname + location.search + location.hash).toBe('/auth/callback');
    expect(createClient).not.toHaveBeenCalled();
  },
);

it('scrubs an authorized callback even when invalid configuration leaves no client', async () => {
  history.replaceState(null, '', '/auth/callback?code=synthetic-code#private');
  const { createClient } = await import('@supabase/supabase-js');
  expect(await bootstrapAuth({ ...SYNTHETIC_ENV, VITE_SUPABASE_URL: 'https://*' })).toBeUndefined();
  expect(location.pathname + location.search + location.hash).toBe('/auth/callback');
  expect(createClient).not.toHaveBeenCalled();
});
