import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { initializeI18n } from '@/i18n';
import { authMock, deferred } from '../../test/authMock';
import { syntheticSession } from '../../test/session';

vi.mock('@/finance/workspace', () => ({
  FinanceWorkspace: ({ account }: { account: import('react').ReactNode }) => <>{account}</>,
}));

async function mount(mock = authMock(), url = '/') {
  history.replaceState(null, '', url);
  const instance = await initializeI18n(createInstance());
  render(
    <I18nextProvider i18n={instance}>
      <MemoryRouter initialEntries={[url]}>
        <App client={mock.client} />
      </MemoryRouter>
    </I18nextProvider>,
  );
  return mock;
}
function offline() {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
}

describe('offline authentication', () => {
  it('keeps language and shell usable during unavailable restoration, and shows honest profile availability after a later SDK result', async () => {
    offline();
    const mock = authMock();
    const read = deferred<Awaited<ReturnType<typeof mock.auth.getSession>>>();
    mock.auth.getSession.mockReturnValue(read.promise);
    await mount(mock);
    expect(await screen.findByRole('alert')).toHaveTextContent('Conecte-se para restaurar');
    expect(screen.getByRole('alert')).toHaveTextContent('Conecte-se');
    await act(async () => read.resolve({ data: { session: syntheticSession() }, error: null }));
    expect(await screen.findByText('person@example.test')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('carregar seu perfil');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
  it('bounds a hung session read even when connectivity is reported online', async () => {
    vi.useFakeTimers();
    try {
      const mock = authMock();
      mock.auth.getSession.mockReturnValue(new Promise(() => {}));
      await mount(mock);
      await act(() => vi.advanceTimersByTimeAsync(8000));
      expect(screen.getByRole('alert')).toHaveTextContent('Conecte-se para restaurar');
      expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
  it.each([false, true])(
    'does not queue offline actions; explicit connection retry is possible (signed in=%s)',
    async (signedIn) => {
      const mock = authMock();
      if (signedIn)
        mock.auth.getSession.mockResolvedValue({
          data: { session: syntheticSession() },
          error: null,
        });
      await mount(mock);
      const action = await screen.findByRole('button', {
        name: signedIn ? 'Sair' : 'Entrar com o Google',
      });
      offline();
      await userEvent.click(action);
      expect(screen.getByRole('alert')).toHaveTextContent(
        signedIn ? 'Conecte-se para sair' : 'Conecte-se para entrar',
      );
      expect(mock.auth.signOut).not.toHaveBeenCalled();
      expect(mock.auth.signInWithOAuth).not.toHaveBeenCalled();
      act(() => window.dispatchEvent(new Event('online')));
      expect(mock.auth.signOut).not.toHaveBeenCalled();
      expect(mock.auth.signInWithOAuth).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: 'Testar a conexão' }));
      expect(signedIn ? mock.auth.signOut : mock.auth.signInWithOAuth).toHaveBeenCalledOnce();
    },
  );
  it('scrubs an offline callback without exchange/replay and preserves an existing SDK session', async () => {
    offline();
    const mock = authMock();
    mock.auth.getSession.mockResolvedValue({ data: { session: syntheticSession() }, error: null });
    await mount(mock, '/auth/callback?code=private-code#access_token=private-token');
    expect(await screen.findByRole('alert')).toHaveTextContent('concluir este login offline');
    expect(location.search + location.hash).toBe('');
    expect(mock.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new Event('online')));
    expect(mock.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('link', { name: 'Voltar' }));
    expect(await screen.findByText('person@example.test')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Conecte-se para carregar seu perfil');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(mock.auth.signOut).not.toHaveBeenCalled();
  });
});
