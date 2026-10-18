import { expect, it, vi } from 'vitest';
import { bootstrapAuth } from './bootstrapAuth';
import { SYNTHETIC_ENV } from '../../test/config';
import { callbackRoute } from './callbackRoute';
import { callbackInputs, callbackPaths, unrelatedPaths } from '../../test/callbackPaths';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ auth: {} })) }));
const { sdkLoad } = vi.hoisted(() => ({ sdkLoad: vi.fn() }));

it.each(callbackPaths)(
  'leaves authorized callback input at %s intact for mounted capture',
  async (path) => {
    vi.doUnmock('./supabase');
    vi.resetModules();
    const state = { sentinel: 'preserve authorized entry' };
    history.replaceState(state, '', `${path}?code=synthetic-code#synthetic-fragment`);
    const href = location.href;
    const length = history.length;
    expect(await bootstrapAuth(SYNTHETIC_ENV)).toBeDefined();
    expect(location.href).toBe(href);
    expect(history.state).toEqual(state);
    expect(history.length).toBe(length);
    const { createClient } = await import('@supabase/supabase-js');
    expect(createClient).toHaveBeenCalledOnce();
  },
);

for (const mode of ['denied', 'production', 'invalid-config']) {
  function configuration() {
    vi.resetModules();
    vi.doMock('./supabase', () => {
      sdkLoad();
      throw new Error('Blocked bootstrap must not load the Auth module.');
    });
    vi.stubGlobal(
      '__AUTH_POLICY__',
      mode === 'invalid-config'
        ? { kind: 'local' }
        : { kind: mode, origin: 'https://synthetic-app.pages.dev' },
    );
    return mode === 'invalid-config'
      ? { ...SYNTHETIC_ENV, VITE_SUPABASE_URL: 'https://*' }
      : SYNTHETIC_ENV;
  }

  it.each(callbackPaths)(
    `immediately scrubs recognized callback %s (${mode}) without a client or request`,
    async (path) => {
      const env = configuration();
      const { createClient } = await import('@supabase/supabase-js');
      const fetch = vi.spyOn(globalThis, 'fetch');
      for (const input of callbackInputs) {
        const state = { sentinel: 'preserve current entry' };
        history.replaceState(state, '', path + input);
        const length = history.length;
        const pending = bootstrapAuth(env);
        expect(location.pathname + location.search + location.hash).toBe(callbackRoute.path);
        expect(history.state).toEqual(state);
        expect(history.length).toBe(length);
        expect(await pending).toBeUndefined();
      }
      expect(createClient).not.toHaveBeenCalled();
      expect(sdkLoad).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each(unrelatedPaths)(
    `preserves unrelated/near-match URL %s (${mode}) without a client or request`,
    async (path) => {
      const env = configuration();
      const { createClient } = await import('@supabase/supabase-js');
      const fetch = vi.spyOn(globalThis, 'fetch');
      for (const input of callbackInputs) {
        const state = { sentinel: 'preserve current entry' };
        history.replaceState(state, '', path + input);
        const href = location.href;
        const length = history.length;
        const replace = vi.spyOn(history, 'replaceState');
        expect(await bootstrapAuth(env)).toBeUndefined();
        expect(location.href).toBe(href);
        expect(history.state).toEqual(state);
        expect(history.length).toBe(length);
        expect(replace).not.toHaveBeenCalled();
        replace.mockRestore();
      }
      expect(createClient).not.toHaveBeenCalled();
      expect(sdkLoad).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    },
  );
}
