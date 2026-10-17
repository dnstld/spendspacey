import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import App from '@/App';
import { initializeI18n } from '@/i18n';
import { authMock, deferred } from '../../test/authMock';
import { syntheticSession } from '../../test/session';

async function setup(url: string, mock = authMock()) {
  window.history.replaceState(null, '', url);
  const instance = await initializeI18n(createInstance(), 'en');
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

describe('OAuth callback', () => {
  it('exchanges only once under Strict Mode, without waiting for initial restoration', async () => {
    const mock = authMock();
    const read = deferred<Awaited<ReturnType<typeof mock.auth.getSession>>>();
    mock.auth.getSession.mockReturnValue(read.promise);
    const exchange = deferred<Awaited<ReturnType<typeof mock.auth.exchangeCodeForSession>>>();
    mock.auth.exchangeCodeForSession.mockReturnValue(exchange.promise);
    await setup('/auth/callback?code=synthetic-code', mock);
    expect(screen.getByRole('status')).toHaveTextContent('Completing sign-in');
    expect(location.search).toBe('');
    const session = syntheticSession();
    await act(async () => {
      mock.emit('SIGNED_IN', session);
      exchange.resolve({ data: { session }, error: null });
    });
    expect(await screen.findByRole('heading', { name: 'Test Person' })).toBeVisible();
    expect(mock.auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith('synthetic-code');
    await act(async () => read.resolve({ data: { session: null }, error: null }));
    expect(screen.getByRole('heading')).toHaveTextContent('Test Person');
  });

  it.each([
    ['/auth/callback', 'unavailable or has expired'],
    ['/auth/callback?error=access_denied&error_description=private-diagnostic', 'cancelled'],
    ['/auth/callback#error=access_denied&error_description=private-diagnostic', 'cancelled'],
    ['/auth/callback?error_code=signup_disabled', 'This account cannot sign in'],
    ['/auth/callback#error_code=signup_disabled', 'This account cannot sign in'],
    [
      '/auth/callback?error=unknown&error_description=private-diagnostic',
      'could not complete sign-in',
    ],
  ])('handles provider or missing-code recovery: %s', async (url, message) => {
    const mock = await setup(url);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled();
    expect(location.search + location.hash).toBe('');
    expect(document.body).not.toHaveTextContent('private-diagnostic');
    expect(mock.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it.each(['flow_state_expired', 'flow_state_not_found', 'bad_code_verifier', 'signup_disabled'])(
    'recovers from %s exchange failure without retrying the code',
    async (code) => {
      const mock = authMock();
      mock.auth.exchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: { code, message: 'private-diagnostic' },
      });
      await setup('/auth/callback?code=synthetic-failed-code', mock);
      expect(await screen.findByRole('alert')).toBeVisible();
      expect(mock.auth.exchangeCodeForSession).toHaveBeenCalledOnce();
      expect(location.search).toBe('');
      expect(document.body).not.toHaveTextContent('private-diagnostic');
    },
  );

  it('does not consume a failed code again after remount', async () => {
    const { exchangeOnce } = await import('./callback');
    const mock = authMock();
    mock.auth.exchangeCodeForSession.mockRejectedValue(new Error('network'));
    expect(await exchangeOnce(mock.client, 'synthetic-reused-code')).toEqual({
      ok: false,
      message: 'callback',
    });
    expect(await exchangeOnce(mock.client, 'synthetic-reused-code')).toEqual({
      ok: false,
      message: 'callback',
    });
    expect(mock.auth.exchangeCodeForSession).toHaveBeenCalledOnce();
  });

  it('exits a network failure and allows a fresh sign-in', async () => {
    const mock = authMock();
    mock.auth.exchangeCodeForSession.mockRejectedValue(new Error('network'));
    await setup('/auth/callback?code=synthetic-network-code', mock);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not complete sign-in');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    expect(mock.auth.signInWithOAuth).toHaveBeenCalledOnce();
    expect(mock.auth.exchangeCodeForSession).toHaveBeenCalledOnce();
  });

  it('preserves an existing valid session on callback failure', async () => {
    const mock = authMock();
    mock.auth.getSession.mockResolvedValue({ data: { session: syntheticSession() }, error: null });
    await setup('/auth/callback?error=access_denied', mock);
    await userEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(await screen.findByRole('heading')).toHaveTextContent('Test Person');
    expect(mock.auth.signOut).not.toHaveBeenCalled();
  });

  it('does not invent a session for an empty successful exchange', async () => {
    const mock = await setup('/auth/callback?code=synthetic-empty-code');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('unavailable or has expired'),
    );
    expect(mock.auth.exchangeCodeForSession).toHaveBeenCalledOnce();
  });
});
