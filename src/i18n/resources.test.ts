import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ptBR } from './pt-BR';
import { initializeI18n } from './index';

function leaves(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof entry === 'string'
        ? [[path, entry]]
        : Object.entries(leaves(entry as Record<string, unknown>, path));
    }),
  );
}

describe('bundled translations', () => {
  it('has identical nonempty leaf keys and interpolation placeholders', () => {
    const english = leaves(en);
    const portuguese = leaves(ptBR);
    expect(Object.keys(portuguese).sort()).toEqual(Object.keys(english).sort());
    for (const [key, text] of Object.entries(english)) {
      expect(text.trim(), key).not.toBe('');
      expect(portuguese[key].trim(), key).not.toBe('');
      const placeholders = (value: string) =>
        [...value.matchAll(/{{\s*-?\s*([^}]+?)\s*}}/g)].map((m) => m[1]).sort();
      expect(placeholders(portuguese[key]), key).toEqual(placeholders(text));
    }
  });

  it.each(['', undefined])(
    'falls back to English for empty or missing Portuguese values',
    async (text) => {
      const instance = await initializeI18n(createInstance(), 'pt-BR');
      instance.removeResourceBundle('pt-BR', 'translation');
      instance.addResourceBundle('pt-BR', 'translation', { auth: { signIn: text } });
      expect(instance.t(($) => $.auth.signIn)).toBe(en.auth.signIn);
      expect(instance.language).toBe('pt-BR');
    },
  );
});
