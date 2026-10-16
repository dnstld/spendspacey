import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './context';
import { authMock, deferred } from '../../test/authMock';
import { syntheticSession } from '../../test/session';

function Probe() {
  const { status, session, message, retry } = useAuth();
  return (
    <>
      <output>
        {status}:{session?.user.email ?? 'none'}:{message}
      </output>
      <button onClick={retry}>retry</button>
    </>
  );
}

describe('session lifecycle', () => {
  it('keeps initialization pending until the explicit session read resolves', async () => {
    const mock = authMock();
    const read = deferred<Awaited<ReturnType<typeof mock.auth.getSession>>>();
    mock.auth.getSession.mockReturnValue(read.promise);
    render(
      <AuthProvider client={mock.client}>
        <Probe />
      </AuthProvider>,
    );
    act(() => mock.emit('INITIAL_SESSION', null));
    expect(screen.getByRole('status')).toHaveTextContent('initializing:none');
    expect(mock.auth.onAuthStateChange.mock.invocationCallOrder[0]).toBeLessThan(
      mock.auth.getSession.mock.invocationCallOrder[0],
    );
    await act(async () => read.resolve({ data: { session: syntheticSession() }, error: null }));
    expect(screen.getByRole('status')).toHaveTextContent('ready:person@example.test');
  });

  it.each(['SIGNED_IN', 'SIGNED_OUT'] as const)(
    'does not overwrite a newer %s event with an old read',
    async (event) => {
      const mock = authMock();
      const read = deferred<Awaited<ReturnType<typeof mock.auth.getSession>>>();
      mock.auth.getSession.mockReturnValue(read.promise);
      render(
        <AuthProvider client={mock.client}>
          <Probe />
        </AuthProvider>,
      );
      const latest = event === 'SIGNED_IN' ? syntheticSession() : null;
      act(() => {
        mock.emit(event, latest);
        mock.emit('INITIAL_SESSION', null);
      });
      await act(async () =>
        read.resolve({
          data: { session: event === 'SIGNED_IN' ? null : syntheticSession() },
          error: null,
        }),
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        latest ? 'ready:person@example.test' : 'ready:none',
      );
    },
  );

  it('handles repeated sign-ins, refreshed/updated identities, and cross-tab sign-out', async () => {
    const mock = authMock();
    render(
      <AuthProvider client={mock.client}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:none'));
    const session = syntheticSession();
    for (const event of ['SIGNED_IN', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'] as const) {
      session.user.email = `${event.toLowerCase()}@example.test`;
      act(() => mock.emit(event, { ...session, user: { ...session.user } }));
      expect(screen.getByRole('status')).toHaveTextContent(session.user.email);
    }
    act(() => mock.emit('SIGNED_OUT', null));
    expect(screen.getByRole('status')).toHaveTextContent('ready:none');
  });

  it.each([false, true])(
    'shows restoration errors and supports retry (rejection=%s)',
    async (rejected) => {
      const mock = authMock();
      if (rejected) mock.auth.getSession.mockRejectedValueOnce(new Error('private diagnostic'));
      else
        mock.auth.getSession.mockResolvedValueOnce({
          data: { session: null },
          error: { message: 'private diagnostic' },
        });
      render(
        <AuthProvider client={mock.client}>
          <Probe />
        </AuthProvider>,
      );
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent('error:none:restore'),
      );
      act(() => screen.getByRole('button').click());
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:none'));
      expect(document.body).not.toHaveTextContent('private diagnostic');
    },
  );

  it('cleans subscriptions and ignores disposed results under Strict Mode', async () => {
    const mock = authMock();
    const old = deferred<Awaited<ReturnType<typeof mock.auth.getSession>>>();
    mock.auth.getSession.mockReturnValueOnce(old.promise);
    const view = render(
      <StrictMode>
        <AuthProvider client={mock.client}>
          <Probe />
        </AuthProvider>
      </StrictMode>,
    );
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:none'));
    expect(mock.listeners.size).toBe(1);
    await act(async () => old.resolve({ data: { session: syntheticSession() }, error: null }));
    expect(screen.getByRole('status')).toHaveTextContent('ready:none');
    view.unmount();
    expect(mock.listeners.size).toBe(0);
    for (const unsubscribe of mock.subscriptions) expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
