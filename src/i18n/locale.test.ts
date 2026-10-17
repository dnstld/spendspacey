import { describe, expect, it, vi } from 'vitest';
import { detectLocale, LOCALE_STORAGE_KEY, resolveLocale, saveLocale } from './locale';

describe('locale resolution', () => {
  it.each(['pt', 'pt-BR', 'pt-PT', 'pt-AO', 'PT-pt', 'pt-BR-u-ca-gregory'])(
    'maps %s to Brazilian Portuguese',
    (tag) => {
      expect(resolveLocale(null, [tag])).toBe('pt-BR');
    },
  );
  it.each(['en', 'en-US', 'en-GB'])('maps %s to English', (tag) => {
    expect(resolveLocale(null, [tag])).toBe('en');
  });
  it('uses the first supported language in preference order', () => {
    expect(resolveLocale(null, ['fr-FR', 'en-GB', 'pt-BR'])).toBe('en');
    expect(resolveLocale(null, ['fr-FR', 'pt-PT', 'en'])).toBe('pt-BR');
  });
  it('ignores malformed and unsupported tags and uses English fallback', () => {
    expect(resolveLocale(null, ['bad_tag', 'fr'])).toBe('en');
    expect(resolveLocale(null)).toBe('en');
    expect(resolveLocale(null, [], 'pt-PT')).toBe('pt-BR');
  });
  it('accepts only canonical explicit preferences', () => {
    expect(resolveLocale('en', ['pt'])).toBe('en');
    expect(resolveLocale('pt-BR', ['en'])).toBe('pt-BR');
    expect(resolveLocale('pt-PT', ['en'])).toBe('en');
    expect(resolveLocale('invalid', ['pt'])).toBe('pt-BR');
  });
  it('does not persist detection and reevaluates devices on launch', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    expect(detectLocale(() => storage, ['en'])).toBe('en');
    expect(detectLocale(() => storage, ['pt-PT'])).toBe('pt-BR');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('persists only explicit choices', () => {
    saveLocale('pt-BR');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('pt-BR');
    expect(detectLocale(() => localStorage, ['en'])).toBe('pt-BR');
  });
  it('tolerates blocked storage access and writes', () => {
    const blocked = () => {
      throw new Error('storage unavailable');
    };
    expect(detectLocale(blocked, ['pt'])).toBe('pt-BR');
    expect(() => saveLocale('pt-BR', blocked)).not.toThrow();
    expect(() => saveLocale('en', () => ({ getItem: () => null, setItem: blocked }))).not.toThrow();
  });
});
