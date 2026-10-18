import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => vi.stubGlobal('__AUTH_POLICY__', { kind: 'local' }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (typeof window !== 'undefined') {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  }
});
