import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { expect, it, vi } from 'vitest';
import App from '@/App';
import { initializeI18n } from '@/i18n';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './context';
import { exchangeOnce } from './callback';
import { authMock } from '../../test/authMock';
import { syntheticSession } from '../../test/session';

async function setup(url = '/') {
  vi.stubGlobal('__PAGES_PREVIEW__', true);
  window.history.replaceState(null, '', url);
  const instance = await initializeI18n(createInstance(), 'en');
  const mock = authMock();
  mock.auth.getSession.mockResolvedValue({ data: { session: syntheticSession() }, error: null });
  render(
    <StrictMode>
      <I18nextProvider i18n={instance}>
        <MemoryRouter initialEntries={[url]}>
          <App client={mock.client} />
        </MemoryRouter>
      </I18nextProvider>
    </StrictMode>,
  );
  return mock;
}

it('keeps preview sign-in disabled and feedback localized without restoring an identity', async () => {
  const mock = await setup();
  expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('unavailable in this preview');
  await userEvent.selectOptions(screen.getByRole('combobox'), 'pt-BR');
  expect(screen.getByRole('alert')).toHaveTextContent('indisponível nesta prévia');
  expect(screen.getByRole('button', { name: 'Entrar com o Google' })).toBeDisabled();
  expect(screen.queryByText('Test Person')).not.toBeInTheDocument();
  expect(mock.auth.getSession).not.toHaveBeenCalled();
  expect(mock.auth.onAuthStateChange).not.toHaveBeenCalled();
  expect(mock.auth.signInWithOAuth).not.toHaveBeenCalled();
});

it('scrubs preview callback input without exchanging or replaying a code', async () => {
  const mock = await setup('/auth/callback?code=synthetic-preview-code#synthetic-fragment');
  expect(screen.getByRole('alert')).toHaveTextContent('unavailable in this preview');
  expect(location.search + location.hash).toBe('');
  expect(await exchangeOnce(mock.client, 'synthetic-preview-code')).toEqual({
    ok: false,
    message: 'previewAuthentication',
  });
  expect(mock.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('link', { name: 'Back' }));
  expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
});

it('also blocks imperative sign-in calls that bypass the disabled control', async () => {
  vi.stubGlobal('__PAGES_PREVIEW__', true);
  const mock = authMock();
  function Probe() {
    const { signIn, message } = useAuth();
    return <button onClick={() => void signIn()}>{message ?? 'start'}</button>;
  }
  render(
    <AuthProvider client={mock.client}>
      <Probe />
    </AuthProvider>,
  );
  await userEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('button')).toHaveTextContent('previewAuthentication');
  expect(mock.auth.signInWithOAuth).not.toHaveBeenCalled();
});
