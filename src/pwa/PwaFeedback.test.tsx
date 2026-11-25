import { render, screen, within } from '@testing-library/react';
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
async function mount(overrides: Partial<AuthContextValue> = {}) {
  const auth = authMock();
  const value: AuthContextValue = {
    client: auth.client,
    status: 'ready',
    generation: 0,
    pending: null,
    session: null,
    message: null,
    retry: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
  const i18n = await initializeI18n(createInstance());
  const view = render(
    <I18nextProvider i18n={i18n}>
      <AuthContext value={value}>
        <PwaFeedback />
      </AuthContext>
    </I18nextProvider>,
  );
  return { ...view, i18n };
}
describe('localized static preparation and recovery feedback', () => {
  it('announces waiting and readiness guidance in Brazilian Portuguese', async () => {
    mock.state.waiting = true;
    mock.state.repaired = true;
    try {
      await mount();
      const region = screen.getByRole('complementary');
      expect(region).toHaveAttribute('aria-live', 'polite');
      expect(within(region).getByText(/Uma atualização está pronta/)).toBeVisible();
      expect(screen.getByTestId('offline-readiness')).toHaveTextContent(
        'Preparado para uso offline',
      );
      expect(within(region).getByText(/O reparo foi concluído/)).toBeVisible();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    } finally {
      mock.state.waiting = false;
      mock.state.repaired = false;
    }
  });

  it.each(['initializing', 'signIn', 'signOut', 'callback'] as const)(
    'blocks repair during %s processing',
    async (pending) => {
      mock.state.repaired = false;
      if (pending === 'callback') history.replaceState(null, '', '/auth/callback');
      await mount(
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
