import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import App from './App';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { initializeI18n } from './i18n';
import { callbackRoute } from './lib/callbackRoute';
import { callbackPaths } from '../test/callbackPaths';

it.each(callbackPaths)(
  'scrubs callback %s when the fallback screen mounts without a client',
  async (path) => {
    const state = { sentinel: 'preserve fallback entry' };
    history.replaceState(state, '', `${path}?code=synthetic-code#error=synthetic-error`);
    const length = history.length;
    const instance = await initializeI18n(createInstance());
    render(
      <I18nextProvider i18n={instance}>
        <App />
      </I18nextProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('configuração pública do aplicativo');
    expect(location.pathname + location.search + location.hash).toBe(callbackRoute.path);
    expect(history.state).toEqual(state);
    expect(history.length).toBe(length);
  },
);

it('shows safe localized configuration feedback without initializing authentication', async () => {
  const instance = await initializeI18n(createInstance());
  render(
    <I18nextProvider i18n={instance}>
      <App />
    </I18nextProvider>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('configuração pública do aplicativo');
  expect(document.body).not.toHaveTextContent('sb_publishable');
});

it('starts in Portuguese without flashing English and updates document metadata', async () => {
  const instance = await initializeI18n(createInstance());
  render(
    <I18nextProvider i18n={instance}>
      <App />
    </I18nextProvider>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível iniciar');
  expect(document.documentElement.lang).toBe('pt-BR');
  expect(document.title).toBe('Spendspacey · Sua conta');
});
