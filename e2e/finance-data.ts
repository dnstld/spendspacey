import type { Route } from '@playwright/test';
import {
  dateKey,
  type Category,
  type CategoryItem,
  type Transaction,
  type Wallet,
} from '../src/finance/model';
import { syntheticSession } from '../test/session';

export const owner = syntheticSession().user.id;
export const familyMember = '20000000-0000-4000-8000-000000000001';
export const thirdMember = '20000000-0000-4000-8000-000000000002';
const memberNames: Record<string, string> = {
  [owner]: 'Test Person',
  [familyMember]: 'Ana',
  [thirdMember]: 'Bruno',
};

export function isFinancePath(path: string) {
  return /^\/rest\/v1\/(?:wallet_members|wallets|categories|category_items|transactions|rpc\/(?:list_web_wallet_members|create_web_wallet|list_web_created_wallets|delete_web_personal_wallet|save_web_transaction))$/.test(
    path,
  );
}

export function financeFixture() {
  const wallets: Wallet[] = [
    {
      id: 'shared',
      name: 'Família',
      currency: 'BRL',
      deletable: false,
      memberIds: [owner, familyMember],
    },
    { id: 'dollars', name: 'Viagem', currency: 'USD', deletable: false, memberIds: [owner] },
    { id: 'euros', name: 'Europa', currency: 'EUR', deletable: false, memberIds: [owner] },
  ];
  const categories: (Category & { wallet_id: string })[] = [
    { id: 'market', name: 'Mercado', type: 'expense', archived_at: null, wallet_id: 'shared' },
    { id: 'salary', name: 'Salário', type: 'income', archived_at: null, wallet_id: 'shared' },
  ];
  const items: (CategoryItem & { wallet_id: string })[] = [
    {
      id: 'groceries',
      category_id: 'market',
      name: 'Compras',
      default_amount_cents: 4200,
      archived_at: null,
      wallet_id: 'shared',
    },
  ];
  const rows: (Transaction & { wallet_id: string })[] = [
    {
      id: 'expense',
      wallet_id: 'shared',
      category_id: 'market',
      category_item_id: null,
      description: 'Feira',
      occurred_at: dateKey(new Date()),
      amount_cents: 1200,
      created_by: owner,
      updated_by: null,
      on_behalf_of: null,
    },
    {
      id: 'income',
      wallet_id: 'shared',
      category_id: 'salary',
      category_item_id: null,
      description: '',
      occurred_at: dateKey(new Date()),
      amount_cents: 10000,
      created_by: owner,
      updated_by: null,
      on_behalf_of: null,
    },
  ];
  const failures = { transaction: false, transactionResponse: false };

  async function handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const walletId = url.searchParams.get('wallet_id')?.slice(3);
    const id = url.searchParams.get('id')?.slice(3);
    const json = (value: unknown) => route.fulfill({ json: value });
    switch (url.pathname) {
      case '/rest/v1/wallet_members':
        return json(
          wallets.map(({ id, name, currency, memberIds }) => ({
            wallet_id: id,
            wallets: {
              id,
              name,
              currency,
              wallet_members: memberIds.map((user_id) => ({ user_id })),
            },
          })),
        );
      case '/rest/v1/rpc/list_web_wallet_members': {
        const wallet = wallets.find((value) => value.id === request.postDataJSON().p_wallet_id);
        return json(
          wallet?.memberIds.map((user_id) => ({
            user_id,
            display_name: memberNames[user_id] ?? 'Outra pessoa',
            email: null,
          })) ?? [],
        );
      }
      case '/rest/v1/rpc/create_web_wallet': {
        const { p_wallet_id, p_name, p_currency } = request.postDataJSON();
        if (!wallets.some((wallet) => wallet.id === p_wallet_id)) {
          wallets.push({
            id: p_wallet_id,
            name: p_name,
            currency: p_currency,
            deletable: true,
            memberIds: [owner],
          });
        }
        return json(p_wallet_id);
      }
      case '/rest/v1/rpc/list_web_created_wallets':
        return json(
          wallets.filter((wallet) => wallet.deletable).map((wallet) => ({ wallet_id: wallet.id })),
        );
      case '/rest/v1/rpc/delete_web_personal_wallet': {
        const { p_wallet_id, p_expected_actor } = request.postDataJSON();
        const index = wallets.findIndex(
          (wallet) =>
            wallet.id === p_wallet_id &&
            wallet.deletable &&
            wallet.memberIds.length === 1 &&
            wallet.memberIds.includes(p_expected_actor) &&
            p_expected_actor === owner,
        );
        if (index < 0) return route.fulfill({ status: 403, json: { code: '42501' } });
        wallets.splice(index, 1);
        for (const records of [rows, categories, items]) {
          for (let i = records.length - 1; i >= 0; i--) {
            if (records[i].wallet_id === p_wallet_id) records.splice(i, 1);
          }
        }
        return json(p_wallet_id);
      }
      case '/rest/v1/wallets': {
        const wallet = wallets.find((value) => value.id === id);
        if (!wallet) return route.fulfill({ status: 404, json: { code: 'PGRST116' } });
        Object.assign(wallet, request.postDataJSON());
        return json({ id });
      }
      case '/rest/v1/categories': {
        if (method === 'GET')
          return json(categories.filter((value) => value.wallet_id === walletId));
        const value =
          method === 'POST'
            ? { id: crypto.randomUUID(), archived_at: null, ...request.postDataJSON() }
            : categories.find((value) => value.id === id);
        if (!value) return route.fulfill({ status: 404 });
        if (method === 'POST') categories.push(value);
        else Object.assign(value, request.postDataJSON());
        return json(value);
      }
      case '/rest/v1/category_items': {
        if (method === 'GET') return json(items.filter((value) => value.wallet_id === walletId));
        const value = { id: crypto.randomUUID(), archived_at: null, ...request.postDataJSON() };
        items.push(value);
        return json(value);
      }
      case '/rest/v1/transactions': {
        if (method === 'GET') {
          const category = url.searchParams.get('category_id')?.slice(3);
          const amount = url.searchParams.get('amount_cents')?.slice(3);
          const dateFilters = url.searchParams.getAll('occurred_at');
          const list = rows.filter(
            (row) =>
              row.wallet_id === walletId &&
              (!category || row.category_id === category) &&
              (!amount || row.amount_cents === Number(amount)) &&
              dateFilters.every((filter) =>
                filter.startsWith('eq.')
                  ? row.occurred_at === filter.slice(3)
                  : filter.startsWith('gte.')
                    ? row.occurred_at >= filter.slice(4)
                    : row.occurred_at < filter.slice(3),
              ),
          );
          return json(url.searchParams.get('limit') === '1' ? list.slice(0, 1) : list);
        }
        return route.fulfill({ status: 405 });
      }
      case '/rest/v1/rpc/save_web_transaction': {
        if (failures.transaction) {
          failures.transaction = false;
          return route.fulfill({ status: 400, json: { code: 'synthetic-failure' } });
        }
        const { p_expected_actor, p_transaction_id, p_wallet_id, p_edit, p_draft } =
          request.postDataJSON();
        if (p_expected_actor !== owner) return route.fulfill({ status: 403 });
        const row = rows.find(
          (value) => value.id === p_transaction_id && value.wallet_id === p_wallet_id,
        );
        const beneficiary = 'on_behalf_of' in p_draft ? p_draft.on_behalf_of : row?.on_behalf_of;
        if (
          beneficiary &&
          !wallets.find((wallet) => wallet.id === p_wallet_id)?.memberIds.includes(beneficiary)
        ) {
          return route.fulfill({
            status: 400,
            json: { message: 'on_behalf_of must be a member of the wallet' },
          });
        }
        if (p_edit) {
          if (!row) return route.fulfill({ status: 403 });
          Object.assign(row, p_draft, { updated_by: owner });
        } else if (row) {
          if (
            Object.entries(p_draft).some(
              ([field, value]) => row[field as keyof Transaction] !== value,
            )
          ) {
            return route.fulfill({
              status: 409,
              json: { message: 'web_transaction_retry_conflict' },
            });
          }
        } else {
          rows.unshift({
            id: p_transaction_id,
            wallet_id: p_wallet_id,
            created_by: owner,
            updated_by: null,
            ...p_draft,
          });
        }
        if (failures.transactionResponse) {
          failures.transactionResponse = false;
          return route.abort('failed');
        }
        return json(p_transaction_id);
      }
      default:
        return undefined;
    }
  }
  return { handle, wallets, categories, rows, failures };
}
