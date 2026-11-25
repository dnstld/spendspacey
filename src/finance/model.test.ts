import { expect, it } from 'vitest';
import { dayLabel, money, periodRange, summarize, type Transaction } from './model';

it('uses local calendar boundaries and includes today in the seven-day shortcut', () => {
  const now = new Date(2026, 0, 3, 23, 59);
  expect(periodRange('today', now)).toEqual({ start: '2026-01-03', end: '2026-01-04' });
  expect(periodRange('week', now)).toEqual({ start: '2025-12-28', end: '2026-01-04' });
  expect(periodRange('month', now)).toEqual({ start: '2026-01-01', end: '2026-02-01' });
  expect(periodRange('year', now)).toEqual({ start: '2026-01-01', end: '2027-01-01' });
  expect(periodRange({ year: 2024, month: 1 }, now)).toEqual({
    start: '2024-02-01',
    end: '2024-03-01',
  });
  expect(periodRange({ year: 2024 }, now)).toEqual({ start: '2024-01-01', end: '2025-01-01' });
  expect(dayLabel('2026-01-02', now)).toBe('Ontem');
  expect(dayLabel('2026-01-03', now)).toBe('Hoje');
});

it('formats currency and keeps category totals in minor units', () => {
  expect(money(142000, 'BRL')).toBe('R$\u00a01.420,00');
  expect(money(142000, 'USD')).toBe('$1,420.00');
  expect(money(142000, 'EUR')).toBe('1.420,00\u00a0€');
  const entry: Transaction = {
    id: 'a',
    category_id: 'grocery',
    category_item_id: null,
    description: '',
    occurred_at: '2026-02-01',
    amount_cents: 1001,
    created_by: null,
    on_behalf_of: null,
    updated_by: null,
  };
  expect(summarize([entry, { ...entry, id: 'b', amount_cents: 5 }]).get('grocery')).toEqual({
    count: 2,
    amount: 1006,
  });
});
