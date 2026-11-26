import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, CategoryItem, Member, Transaction, Wallet } from './model';

type Result<T> = { data: T | null; error: unknown };

export function checked<T>({ data, error }: Result<T>): T {
  if (error || data === null) throw error || new Error('O serviço não devolveu o registro.');
  return data;
}

const pageSize = 500;
async function allRows<T>(page: (from: number, to: number) => PromiseLike<Result<T[]>>) {
  const rows: T[] = [];
  for (let start = 0; ; start += pageSize) {
    const batch = checked(await page(start, start + pageSize - 1));
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}

export async function readWallets(client: SupabaseClient, userId: string, signal: AbortSignal) {
  const rows = await allRows((from, to) =>
    client
      .from('wallet_members')
      .select('wallet_id, wallets!inner(id,name,currency,created_by,wallet_members(user_id))')
      .eq('user_id', userId)
      .order('joined_at')
      .order('wallet_id')
      .range(from, to)
      .abortSignal(signal)
      .returns<
        { wallets: Omit<Wallet, 'memberIds'> & { wallet_members: { user_id: string }[] } }[]
      >(),
  );
  return rows.map(({ wallets: { wallet_members, ...wallet } }) => ({
    ...wallet,
    memberIds: wallet_members.map(({ user_id }) => user_id).sort(),
  }));
}

export function readWalletData(client: SupabaseClient, walletId: string, signal: AbortSignal) {
  return Promise.all([
    allRows((from, to) =>
      client
        .from('categories')
        .select('id,name,type,archived_at')
        .eq('wallet_id', walletId)
        .order('id')
        .range(from, to)
        .abortSignal(signal)
        .returns<Category[]>(),
    ),
    allRows((from, to) =>
      client
        .from('category_items')
        .select('id,category_id,name,default_amount_cents,archived_at')
        .eq('wallet_id', walletId)
        .order('id')
        .range(from, to)
        .abortSignal(signal)
        .returns<CategoryItem[]>(),
    ),
    client
      .rpc('list_wallet_members', { p_wallet_id: walletId })
      .abortSignal(signal)
      .then(({ data, error }) => {
        if (error || !Array.isArray(data)) throw error || new Error('Participantes indisponíveis.');
        return data as Member[];
      }),
    client
      .from('transactions')
      .select('occurred_at')
      .eq('wallet_id', walletId)
      .eq('status', 'completed')
      .order('occurred_at')
      .limit(1)
      .abortSignal(signal)
      .returns<{ occurred_at: string }[]>()
      .then(checked),
  ]).then(([categories, items, members, earliest]) => ({
    categories,
    items,
    members,
    firstYear: Number(earliest[0]?.occurred_at.slice(0, 4)) || new Date().getFullYear(),
  }));
}

const transactionColumns =
  'id,category_id,category_item_id,description,occurred_at,amount_cents,created_by,on_behalf_of,updated_by';

export function readTransactions(
  client: SupabaseClient,
  walletId: string,
  range: { start: string; end: string },
  signal: AbortSignal,
) {
  return allRows((from, to) =>
    client
      .from('transactions')
      .select(transactionColumns)
      .eq('wallet_id', walletId)
      .eq('status', 'completed')
      .gte('occurred_at', range.start)
      .lt('occurred_at', range.end)
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to)
      .abortSignal(signal)
      .returns<Transaction[]>(),
  );
}

export function readDuplicates(
  client: SupabaseClient,
  walletId: string,
  categoryId: string,
  day: string,
  amount: number,
  signal: AbortSignal,
) {
  return client
    .from('transactions')
    .select(transactionColumns)
    .eq('wallet_id', walletId)
    .eq('status', 'completed')
    .eq('category_id', categoryId)
    .eq('occurred_at', day)
    .eq('amount_cents', amount)
    .order('created_at', { ascending: false })
    .abortSignal(signal)
    .returns<Transaction[]>()
    .then(checked);
}
