export const currencies = ['BRL', 'USD', 'EUR'] as const;
export type Currency = (typeof currencies)[number];
export type Kind = 'expense' | 'income';
export type View = 'transactions' | 'categories' | 'wallets';

export interface Wallet {
  id: string;
  name: string;
  currency: Currency;
  created_by: string | null;
  memberIds: string[];
}

export interface Category {
  id: string;
  name: string;
  type: Kind;
  archived_at: string | null;
}

export interface CategoryItem {
  id: string;
  category_id: string;
  name: string;
  default_amount_cents: number | null;
  archived_at: string | null;
}

export interface Transaction {
  id: string;
  category_id: string;
  category_item_id: string | null;
  description: string;
  occurred_at: string;
  amount_cents: number;
  created_by: string | null;
  on_behalf_of: string | null;
  updated_by: string | null;
}

export interface Member {
  user_id: string;
  display_name: string | null;
  email: string | null;
}

export const shortcuts = {
  today: 'Hoje',
  month: 'Este mês',
  year: 'Este ano',
  week: 'Últimos 7 dias',
} as const;

export type Period = keyof typeof shortcuts | { year: number; month?: number };

export const monthLabels = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(new Date(2020, month, 1))
    .replace('.', ''),
);

export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function periodRange(period: Period, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  if (typeof period === 'object') {
    const { year, month } = period;
    return {
      start: dateKey(new Date(year, month ?? 0, 1)),
      end: dateKey(
        new Date(year + (month === undefined ? 1 : 0), month === undefined ? 0 : month + 1, 1),
      ),
    };
  }
  if (period === 'today' || period === 'week') {
    return {
      start: dateKey(new Date(year, month, day - (period === 'week' ? 6 : 0))),
      end: dateKey(new Date(year, month, day + 1)),
    };
  }
  return periodRange({ year, month: period === 'month' ? month : undefined }, now);
}

export function periodLabel(period: Period) {
  if (typeof period === 'string') return shortcuts[period];
  return period.month === undefined
    ? String(period.year)
    : `${monthLabels[period.month]}/${period.year}`;
}

export function dayLabel(day: string, now = new Date()) {
  if (day === dateKey(now)) return 'Hoje';
  if (day === dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)))
    return 'Ontem';
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, date));
}

const moneyFormats = {
  BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
};

export function money(cents: number, currency: Currency) {
  return moneyFormats[currency].format(cents / 100);
}

export function summarize(transactions: Transaction[]) {
  const summary = new Map<string, { amount: number; count: number }>();
  for (const transaction of transactions) {
    const current = summary.get(transaction.category_id) ?? { amount: 0, count: 0 };
    summary.set(transaction.category_id, {
      amount: current.amount + transaction.amount_cents,
      count: current.count + 1,
    });
  }
  return summary;
}

export function memberName(member?: Member) {
  return member?.display_name || member?.email || 'Pessoa indisponível';
}
