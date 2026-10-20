import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '@/auth/context';
import { initializeI18n } from '@/i18n';
import { authMock } from '../../test/authMock';
import { PwaFeedback } from './PwaFeedback';

const mock = vi.hoisted(() => ({
  state: {
    readiness: 'prepared',
    waiting: false,
    recovery: true,
    repairing: false,
    repaired: false,
  },
  repair: vi.fn(),
}));
vi.mock('./lifecycle', () => ({
  pwaSnapshot: () => mock.state,
  subscribePwa: () => () => {},
  repairStaticShell: mock.repair,
}));
async function mount(locale: 'en' | 'pt-BR' = 'en', overrides: Partial<AuthContextValue> = {}) {
  const auth = authMock();
  const value: AuthContextValue = {
    client: auth.client,
    status: 'ready',
    pending: null,
    session: null,
    message: null,
    retry: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
  const i18n = await initializeI18n(createInstance(), locale);
  return render(
    <I18nextProvider i18n={i18n}>
      <AuthContext value={value}>
        <PwaFeedback />
      </AuthContext>
    </I18nextProvider>,
  );
}
describe('localized static preparation and recovery feedback', () => {
  it.each(['en', 'pt-BR'] as const)(
    'distinguishes preparation from control and shows reload/reopen guidance in %s',
    async (locale) => {
      mock.state.repaired = true;
      await mount(locale);
      expect(screen.getByTestId('offline-readiness')).toHaveTextContent(
        locale === 'en' ? 'Prepared for offline' : 'Preparado para uso offline',
      );
      expect(
        screen.getByText(locale === 'en' ? /Verified repair is ready/ : /O reparo foi concluído/),
      ).toBeVisible();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      mock.state.repaired = false;
    },
  );
  it.each(['initializing', 'signIn', 'signOut', 'callback'] as const)(
    'blocks repair during %s processing',
    async (pending) => {
      mock.state.repaired = false;
      if (pending === 'callback') history.replaceState(null, '', '/auth/callback');
      await mount(
        'en',
        pending === 'initializing'
          ? { status: 'initializing' }
          : pending === 'callback'
            ? {}
            : { pending },
      );
      expect(screen.getByRole('alert')).toBeVisible();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(mock.repair).not.toHaveBeenCalled();
    },
  );
  it('offers explicit static repair only when authentication is settled', async () => {
    mock.state.repaired = false;
    await mount();
    await userEvent.click(screen.getByRole('button'));
    expect(mock.repair).toHaveBeenCalledExactlyOnceWith(false);
  });
});
