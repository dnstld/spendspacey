import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import App from './App';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { initializeI18n } from './i18n';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { callbackRoute } from './lib/callbackRoute';
import { callbackPaths } from '../test/callbackPaths';

it.each(callbackPaths)(
  'scrubs callback %s when the fallback screen mounts without a client',
  async (path) => {
    const state = { sentinel: 'preserve fallback entry' };
    history.replaceState(state, '', `${path}?code=synthetic-code#error=synthetic-error`);
    const length = history.length;
    const instance = await initializeI18n(createInstance(), 'en');
    render(
      <I18nextProvider i18n={instance}>
        <App />
      </I18nextProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('public application configuration');
    expect(location.pathname + location.search + location.hash).toBe(callbackRoute.path);
    expect(history.state).toEqual(state);
    expect(history.length).toBe(length);
  },
);

it('shows safe localized configuration feedback without initializing authentication', async () => {
  const instance = await initializeI18n(createInstance(), 'en');
  render(
    <I18nextProvider i18n={instance}>
      <App />
    </I18nextProvider>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('public application configuration');
  expect(document.body).not.toHaveTextContent('sb_publishable');
});

it('starts in Portuguese without flashing English and updates document metadata', async () => {
  const instance = await initializeI18n(createInstance(), 'pt-BR');
  render(
    <I18nextProvider i18n={instance}>
      <App />
    </I18nextProvider>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível iniciar');
  expect(document.documentElement.lang).toBe('pt-BR');
  expect(document.title).toBe('Spendspacey · Sua conta');
});

it('changes existing feedback, accessible labels, title, and explicit preference in place', async () => {
  const instance = await initializeI18n(createInstance(), 'en');
  render(
    <I18nextProvider i18n={instance}>
      <App />
    </I18nextProvider>,
  );
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'pt-BR');
  expect(screen.getByRole('combobox', { name: 'Idioma' })).toHaveValue('pt-BR');
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível iniciar');
  expect(document.documentElement.lang).toBe('pt-BR');
  expect(document.title).toBe('Spendspacey · Sua conta');
  expect(localStorage.getItem('spendspacey.locale')).toBe('pt-BR');
});

it('still switches language if persistence is denied', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const instance = await initializeI18n(createInstance(), 'en');
  render(
    <I18nextProvider i18n={instance}>
      <App />
    </I18nextProvider>,
  );
  await userEvent.selectOptions(screen.getByRole('combobox'), 'pt-BR');
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível iniciar');
});
