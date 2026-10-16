import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { AuthScreen } from './AuthScreen';
import { Shell } from '@/components/Shell';
import { initializeI18n } from '@/i18n';
import { authMock, deferred } from '../../test/authMock';
import { syntheticSession } from '../../test/session';

async function setup(mock = authMock()) {
  const instance = await initializeI18n(createInstance(), 'en');
  render(
    <I18nextProvider i18n={instance}>
      <AuthProvider client={mock.client}>
        <Shell>
          <AuthScreen />
        </Shell>
      </AuthProvider>
    </I18nextProvider>,
  );
  return mock;
}

describe('authentication screen', () => {
  it('has no sign-in flash during initialization', async () => {
    const mock = authMock();
    const read = deferred<Awaited<ReturnType<typeof mock.auth.getSession>>>();
    mock.auth.getSession.mockReturnValue(read.promise);
    await setup(mock);
    expect(screen.getByRole('status')).toHaveTextContent('Getting your space ready');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await act(async () => read.resolve({ data: { session: null }, error: null }));
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  });

  it('starts Google PKCE at the application callback and prevents repeated starts', async () => {
    const mock = await setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));
    expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback`, scopes: 'openid email profile' },
    });
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('heading')).toHaveTextContent('Spendspacey');
  });

  it('recovers from sign-in failure without echoing diagnostics', async () => {
    const mock = authMock();
    mock.auth.signInWithOAuth.mockResolvedValueOnce({ error: { message: 'private diagnostic' } });
    await setup(mock);
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not start sign-in');
    expect(screen.getByRole('button')).toBeEnabled();
    expect(document.body).not.toHaveTextContent('private diagnostic');
  });

  it('reports unavailable authentication storage before starting OAuth', async () => {
    const mock = await setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('needs browser storage');
    expect(mock.auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('shows only identity/actions and signs out locally without losing language', async () => {
    const mock = authMock();
    const session = syntheticSession();
    mock.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    mock.auth.signOut.mockImplementation(async () => {
      mock.emit('SIGNED_OUT', null);
      return { error: null };
    });
    await setup(mock);
    expect(await screen.findByRole('heading', { name: 'Test Person' })).toBeVisible();
    expect(screen.getByText('person@example.test')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Spendspacey' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in with Google' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'pt-BR');
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(mock.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(await screen.findByRole('button', { name: 'Entrar com o Google' })).toBeVisible();
    expect(localStorage.getItem('spendspacey.locale')).toBe('pt-BR');
  });

  it('retains the actual authenticated view when sign-out fails', async () => {
    const mock = authMock();
    mock.auth.getSession.mockResolvedValue({ data: { session: syntheticSession() }, error: null });
    mock.auth.signOut.mockRejectedValueOnce(new Error('private diagnostic'));
    await setup(mock);
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not sign you out');
    expect(screen.getByRole('heading')).toHaveTextContent('Test Person');
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('renders metadata as text and rejects unsafe avatar URLs', async () => {
    const mock = authMock();
    const session = syntheticSession();
    session.user.user_metadata = {
      full_name: '<script>synthetic()</script>',
      avatar_url: 'javascript:synthetic()',
    };
    mock.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    await setup(mock);
    expect(await screen.findByRole('heading')).toHaveTextContent('<script>synthetic()</script>');
    expect(document.querySelector('script')).toBeNull();
    expect(await screen.findByRole('img', { name: 'Profile photo unavailable' })).toBeVisible();
  });

  it('provides localized missing-field fallbacks and retry for restoration', async () => {
    const mock = authMock();
    mock.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: { code: 'network' },
    });
    await setup(mock);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeVisible(),
    );
    const session = syntheticSession();
    session.user.email = undefined;
    session.user.user_metadata = {};
    act(() => mock.emit('SIGNED_IN', session));
    expect(screen.getByRole('heading')).toHaveTextContent('Name unavailable');
    expect(screen.getByText('Email unavailable')).toBeVisible();
  });
});
