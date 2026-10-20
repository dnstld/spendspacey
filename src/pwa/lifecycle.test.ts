import { describe, expect, it, vi } from 'vitest';
import { deferred } from '../../test/authMock';

describe('worker registration feature detection and update coalescing', () => {
  it('registers only production and reports unavailable features without blocking online UI', async () => {
    vi.resetModules();
    const register = vi.fn();
    vi.stubGlobal('navigator', { serviceWorker: { register }, onLine: true });
    const local = await import('./lifecycle');
    local.startPwa(false);
    expect(register).not.toHaveBeenCalled();
    expect(local.pwaSnapshot().readiness).toBe('unavailable');
    vi.resetModules();
    vi.stubGlobal('navigator', { onLine: true });
    const unsupported = await import('./lifecycle');
    unsupported.startPwa(true);
    expect(unsupported.pwaSnapshot().readiness).toBe('unavailable');
  });
  it('coalesces launch, foreground and reconnect updates and never forces activation/reload', async () => {
    vi.resetModules();
    const update = deferred<void>();
    const registration = {
      waiting: null,
      installing: null,
      update: vi.fn(() => update.promise),
      addEventListener: vi.fn(),
    };
    const register = vi.fn(async () => registration);
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register,
        addEventListener: vi.fn(),
        controller: null,
        ready: new Promise(() => {}),
      },
      onLine: true,
    });
    vi.stubGlobal('caches', {});
    const lifecycle = await import('./lifecycle');
    lifecycle.startPwa(true);
    lifecycle.startPwa(true);
    await Promise.resolve();
    expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    lifecycle.checkForUpdate();
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(registration.update).toHaveBeenCalledOnce();
    update.resolve();
    await update.promise;
    lifecycle.checkForUpdate();
    expect(registration.update).toHaveBeenCalledOnce();
  });
});
