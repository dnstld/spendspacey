import { createInstance } from 'i18next';
import { expect, it, vi } from 'vitest';
import { ptBR } from './pt-BR';
import { initializeI18n } from './index';

it('ships nonempty Brazilian Portuguese messages and interpolates the profile name', async () => {
  for (const group of Object.values(ptBR)) {
    for (const message of Object.values(group)) expect(message.trim()).not.toBe('');
  }
  const instance = await initializeI18n(createInstance());
  expect(instance.t(($) => $.profile.avatar, { name: 'Ana' })).toBe('Foto do perfil de Ana');
});

it('uses only Brazilian Portuguese with an English device and saved preference', async () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
  localStorage.setItem('spendspacey.locale', 'en');
  try {
    const instance = await initializeI18n(createInstance());
    expect(instance.language).toBe('pt-BR');
    expect(document.documentElement.lang).toBe('pt-BR');
    expect(instance.hasResourceBundle('en', 'translation')).toBe(false);
    expect(instance.t(($) => $.auth.signIn)).toBe('Entrar com o Google');
  } finally {
    localStorage.removeItem('spendspacey.locale');
  }
});
