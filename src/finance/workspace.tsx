import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FinanceHeader, FinanceDock } from './chrome';
import { Categories } from './categories';
import { readTransactions, readWalletData, readWallets } from './data';
import { periodRange, type Period, type Transaction, type View, type Wallet } from './model';
import { FinanceState, LoadError } from './state';
import { TransactionForm } from './transaction-form';
import { Totals, TransactionList } from './transactions';
import { useOnline, useResource } from './use-resource';
import { Wallets } from './wallets';

type WalletData = Awaited<ReturnType<typeof readWalletData>>;

export function FinanceWorkspace({
  client,
  userId,
  account,
  connected = true,
  accountIsCurrent,
}: {
  client: SupabaseClient;
  userId: string;
  account: ReactNode;
  connected?: boolean;
  accountIsCurrent: () => boolean;
}) {
  const online = useOnline() && connected;
  const [view, setView] = useState<View>('transactions');
  const [period, setPeriod] = useState<Period>('month');
  const [access, setAccess] = useState({ online, epoch: 0 });
  if (access.online !== online) setAccess({ online, epoch: access.epoch + 1 });
  const [selected, setSelected] = useState<string>();
  const list = useResource(
    `${userId}:${access.epoch}`,
    online,
    useCallback((signal) => readWallets(client, userId, signal), [client, userId]),
    { fresh: true, timeout: 10_000 },
  );
  const { retry: revalidateAccess, poll: pollAccess } = list;
  useEffect(() => {
    if (!online) return;
    const refreshOnForeground = () => {
      if (document.visibilityState === 'visible') revalidateAccess();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') pollAccess();
    }, 30_000);
    window.addEventListener('focus', refreshOnForeground);
    document.addEventListener('visibilitychange', refreshOnForeground);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshOnForeground);
      document.removeEventListener('visibilitychange', refreshOnForeground);
    };
  }, [online, revalidateAccess, pollAccess]);
  const wallets = list.data ?? [];
  const active = wallets.find((wallet) => wallet.id === selected) ?? wallets[0];
  const { start, end } = periodRange(period);
  const activeId = active?.id;
  const details = useResource(
    activeId ? `${access.epoch}:${activeId}` : null,
    online,
    useCallback(
      (signal) =>
        activeId
          ? readWalletData(client, activeId, signal)
          : Promise.reject(new Error('Nenhuma carteira selecionada.')),
      [activeId, client],
    ),
  );
  const transactions = useResource(
    activeId ? `${access.epoch}:${activeId}:${start}:${end}` : null,
    online,
    useCallback(
      (signal) =>
        activeId
          ? readTransactions(client, activeId, { start, end }, signal)
          : Promise.reject(new Error('Nenhuma carteira selecionada.')),
      [activeId, client, start, end],
    ),
  );
  const opener = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState<{
    wallet: Wallet;
    data: WalletData;
    rows: Transaction[];
    current?: Transaction;
  }>();
  const draftRevoked =
    draft &&
    (list.error || (list.data && !wallets.some((wallet) => wallet.id === draft.wallet.id)));
  if (draftRevoked) setDraft(undefined);
  const visibleDraft = draftRevoked ? undefined : draft;
  const closeDraft = () => {
    setDraft(undefined);
    requestAnimationFrame(() => opener.current?.focus());
  };

  function edit(current?: Transaction) {
    if (!online || !active || !details.data || !transactions.data) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDraft({ wallet: active, data: details.data, rows: transactions.data, current });
  }

  function navigate(next: View) {
    if (view !== 'transactions' && next === 'transactions') setPeriod('month');
    setView(next);
  }

  function updateWallets(id?: string) {
    if (id) setSelected(id);
    list.retry();
  }

  const unavailable = !online ? (
    <FinanceState
      kind="offline"
      title="Você está offline"
      description="Sua sessão continua aberta. Reconecte-se para carregar dados e salvar alterações."
    />
  ) : list.error ? (
    <LoadError retry={list.retry} />
  ) : !list.data ? (
    <p role="status" className="py-5 text-sm text-muted-foreground">
      Carregando carteiras…
    </p>
  ) : !active ? (
    <FinanceState
      title="Nenhuma carteira"
      description="Crie uma carteira para começar a registrar suas transações."
      action={{ label: 'Gerenciar carteiras', run: () => navigate('wallets') }}
    />
  ) : details.error ? (
    <LoadError retry={details.retry} />
  ) : transactions.error ? (
    <LoadError retry={transactions.retry} />
  ) : !details.data || !transactions.data ? (
    <p role="status" className="py-5 text-sm text-muted-foreground">
      Carregando registros…
    </p>
  ) : null;

  const ready = online && active && details.data && transactions.data;
  function refreshAll() {
    details.retry();
    transactions.retry();
  }

  return (
    <div className="finance-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <FinanceHeader
        view={view}
        wallets={wallets}
        active={active}
        onWallet={(id) => {
          setDraft(undefined);
          setSelected(id);
        }}
        period={period}
        onPeriod={setPeriod}
        firstYear={details.data?.firstYear ?? new Date().getFullYear()}
      />
      <main
        className="finance-column flex min-h-0 flex-1 flex-col pt-4"
        aria-label={
          view === 'transactions'
            ? 'Transações'
            : view === 'categories'
              ? 'Categorias'
              : 'Carteiras'
        }
      >
        {view === 'transactions' && ready && (
          <Totals
            rows={transactions.data!}
            categories={details.data!.categories}
            currency={active.currency}
          />
        )}
        <div className="finance-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {view === 'wallets' ? (
            <>
              {unavailable && (!online || list.error || !list.data) && unavailable}
              <Wallets
                wallets={online ? wallets : []}
                activeId={activeId}
                userId={userId}
                client={client}
                online={online && !!list.data}
                change={updateWallets}
                account={account}
              />
            </>
          ) : (
            (unavailable ??
            (ready &&
              (view === 'transactions' ? (
                transactions.data!.length > 0 ? (
                  <TransactionList
                    rows={transactions.data!}
                    categories={details.data!.categories}
                    currency={active.currency}
                    members={details.data!.members}
                    showMembers={active.memberCount > 1}
                    onEdit={edit}
                  />
                ) : (
                  <FinanceState
                    title="Nenhuma transação no período"
                    description="Registre uma transação ou escolha outro período."
                    action={{ label: 'Nova transação', run: () => edit() }}
                  />
                )
              ) : (
                <Categories
                  key={active.id}
                  categories={details.data!.categories}
                  wallet={active}
                  client={client}
                  online={online}
                  rows={transactions.data!}
                  members={details.data!.members}
                  period={period}
                  onChange={refreshAll}
                />
              ))))
          )}
        </div>
      </main>
      <FinanceDock view={view} onNavigate={navigate} onAdd={() => edit()} canAdd={!!ready} />
      {visibleDraft && (
        <TransactionForm
          current={visibleDraft.current}
          categories={visibleDraft.data.categories}
          items={visibleDraft.data.items}
          members={visibleDraft.data.members}
          wallet={visibleDraft.wallet}
          userId={userId}
          online={online}
          authorized={visibleDraft.wallet.id === activeId}
          accountIsCurrent={accountIsCurrent}
          client={client}
          rankedRows={visibleDraft.rows}
          close={closeDraft}
          onSaved={refreshAll}
        />
      )}
    </div>
  );
}
