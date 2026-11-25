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

vi.mock('@/finance/workspace', () => ({
  FinanceWorkspace: ({ account }: { account: import('react').ReactNode }) => <>{account}</>,
}));

async function setup(mock = authMock()) {
  const instance = await initializeI18n(createInstance());
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
    expect(screen.getByRole('status')).toHaveTextContent('Preparando seu espaço');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await act(async () => read.resolve({ data: { session: null }, error: null }));
    expect(screen.getByRole('button', { name: 'Entrar com o Google' })).toBeVisible();
  });

  it('starts Google PKCE at the application callback and prevents repeated starts', async () => {
    const mock = await setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar com o Google' }));
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
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar com o Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível iniciar o login');
    expect(screen.getByRole('button')).toBeEnabled();
    expect(document.body).not.toHaveTextContent('private diagnostic');
  });

  it('reports unavailable authentication storage before starting OAuth', async () => {
    const mock = await setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar com o Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('precisa do armazenamento');
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
    expect(screen.queryByRole('button', { name: 'Entrar com o Google' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(mock.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(await screen.findByRole('button', { name: 'Entrar com o Google' })).toBeVisible();
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('retains the actual authenticated view when sign-out fails', async () => {
    const mock = authMock();
    mock.auth.getSession.mockResolvedValue({ data: { session: syntheticSession() }, error: null });
    mock.auth.signOut.mockRejectedValueOnce(new Error('private diagnostic'));
    await setup(mock);
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível sair');
    expect(screen.getByRole('heading')).toHaveTextContent('Test Person');
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('clears the profile immediately while sign-out is pending and reloads it after failure', async () => {
    const mock = authMock();
    const signOut = deferred<Awaited<ReturnType<typeof mock.auth.signOut>>>();
    const freshProfile = deferred<Awaited<ReturnType<typeof mock.profile.maybeSingle>>>();
    mock.auth.getSession.mockResolvedValue({ data: { session: syntheticSession() }, error: null });
    mock.auth.signOut.mockReturnValue(signOut.promise);
    await setup(mock);
    expect(await screen.findByRole('heading', { name: 'Test Person' })).toBeVisible();
    mock.profile.maybeSingle.mockReturnValueOnce(freshProfile.promise);
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(screen.queryByRole('heading', { name: 'Test Person' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Foto do perfil de Test Person' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saindo…' })).toBeDisabled();
    await act(async () => signOut.resolve({ error: { message: 'private diagnostic' } }));
    expect(await screen.findByText('Carregando seu perfil…')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('heading', { name: 'Test Person' })).not.toBeInTheDocument();
    expect(mock.auth.getUser).toHaveBeenCalledTimes(2);
    expect(mock.profile.maybeSingle).toHaveBeenCalledTimes(2);
    await act(async () =>
      freshProfile.resolve({
        data: {
          id: syntheticSession().user.id,
          display_name: 'Fresh Person',
          avatar_url: null,
          updated_at: '2026-10-30T12:00:00Z',
        },
        error: null,
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Fresh Person' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível sair');
  });

  it('renders metadata as text and rejects unsafe avatar URLs', async () => {
    const mock = authMock();
    const session = syntheticSession();
    session.user.user_metadata = {
      full_name: '<script>synthetic()</script>',
      avatar_url: 'javascript:synthetic()',
    };
    mock.profile.maybeSingle.mockResolvedValueOnce({
      data: {
        id: session.user.id,
        display_name: '<script>synthetic()</script>',
        avatar_url: 'javascript:synthetic()',
        updated_at: '2026-10-30T12:00:00Z',
      },
      error: null,
    });
    mock.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    await setup(mock);
    expect(await screen.findByRole('heading')).toHaveTextContent('<script>synthetic()</script>');
    expect(document.querySelector('script')).toBeNull();
    expect(await screen.findByRole('img', { name: 'Foto de perfil indisponível' })).toBeVisible();
  });

  it('keeps SDK email and controls usable while the database profile loads', async () => {
    const mock = authMock();
    const profile = deferred<Awaited<ReturnType<typeof mock.profile.maybeSingle>>>();
    mock.auth.getSession.mockResolvedValue({ data: { session: syntheticSession() }, error: null });
    mock.profile.maybeSingle.mockReturnValue(profile.promise);
    await setup(mock);
    expect(await screen.findByText('Carregando seu perfil…')).toHaveAttribute('role', 'status');
    expect(screen.getByText('person@example.test')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    await act(async () =>
      profile.resolve({
        data: {
          id: syntheticSession().user.id,
          display_name: 'Database Person',
          avatar_url: null,
          updated_at: '2026-10-30T12:00:00Z',
        },
        error: null,
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Database Person' })).toBeVisible();
  });

  it('shows a missing profile without fabricating a card', async () => {
    const mock = authMock();
    mock.auth.getSession.mockResolvedValue({ data: { session: syntheticSession() }, error: null });
    mock.profile.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await setup(mock);
    expect(
      await screen.findByText('Seu perfil no banco de dados não está disponível.'),
    ).toBeVisible();
    expect(screen.getByText('person@example.test')).toBeVisible();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('localizes safe profile recovery and retries without exposing diagnostics', async () => {
    const mock = authMock();
    mock.auth.getSession.mockResolvedValue({ data: { session: syntheticSession() }, error: null });
    mock.profile.maybeSingle
      .mockResolvedValueOnce({ data: null, error: { message: 'private profile diagnostic' } })
      .mockResolvedValueOnce({
        data: {
          id: syntheticSession().user.id,
          display_name: null,
          avatar_url: null,
          updated_at: '2026-10-30T12:00:00Z',
        },
        error: null,
      });
    await setup(mock);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar seu perfil',
    );
    expect(document.body).not.toHaveTextContent('private profile diagnostic');
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar carregar o perfil novamente' }),
    );
    expect(await screen.findByRole('heading', { name: 'Nome indisponível' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Foto de perfil indisponível' })).toBeVisible();
  });

  it('provides localized missing-field fallbacks and retry for restoration', async () => {
    const mock = authMock();
    mock.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: { code: 'network' },
    });
    await setup(mock);
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Entrar com o Google' })).toBeVisible(),
    );
    const session = syntheticSession();
    session.user.email = undefined;
    session.user.user_metadata = {};
    mock.auth.getUser.mockResolvedValueOnce({ data: { user: session.user }, error: null });
    mock.profile.maybeSingle.mockResolvedValueOnce({
      data: {
        id: session.user.id,
        display_name: null,
        avatar_url: null,
        updated_at: '2026-10-30T12:00:00Z',
      },
      error: null,
    });
    act(() => mock.emit('SIGNED_IN', session));
    expect(await screen.findByRole('heading')).toHaveTextContent('Nome indisponível');
    expect(screen.getByText('E-mail indisponível')).toBeVisible();
  });
});
