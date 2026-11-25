import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  dayLabel,
  memberName,
  money,
  summarize,
  type Category,
  type Currency,
  type Member,
  type Transaction,
} from './model';

export function Totals({
  rows,
  categories,
  currency,
}: {
  rows: Transaction[];
  categories: Category[];
  currency: Currency;
}) {
  const summary = summarize(rows);
  const totals = { expense: 0, income: 0 };
  for (const category of categories) totals[category.type] += summary.get(category.id)?.amount ?? 0;
  return (
    <dl className="mb-2 space-y-2 border-b pb-4">
      <div>
        <dt className="text-sm text-muted-foreground">Gastos</dt>
        <dd className="text-3xl font-bold tabular-nums">{money(totals.expense, currency)}</dd>
      </div>
      <div>
        <dt className="text-sm text-muted-foreground">Entradas</dt>
        <dd className="text-lg font-bold text-green-700 tabular-nums">
          {money(totals.income, currency)}
        </dd>
      </div>
    </dl>
  );
}

export function TransactionList({
  rows,
  categories,
  currency,
  members,
  showMembers,
  onEdit,
}: {
  rows: Transaction[];
  categories: Category[];
  currency: Currency;
  members: Member[];
  showMembers: boolean;
  onEdit?: (transaction: Transaction) => void;
}) {
  const days = new Map<string, Transaction[]>();
  for (const row of rows) {
    const day = days.get(row.occurred_at);
    if (day) day.push(row);
    else days.set(row.occurred_at, [row]);
  }
  const byCategory = new Map(categories.map((category) => [category.id, category]));
  const byMember = new Map(members.map((member) => [member.user_id, member]));
  return (
    <div className="divide-y">
      {[...days].map(([date, transactions]) => (
        <section key={date} aria-label={dayLabel(date)} className="space-y-1 py-3">
          <h2 className="text-sm font-bold text-muted-foreground">{dayLabel(date)}</h2>
          <ul className="divide-y divide-border/60">
            {transactions.map((item) => {
              const category = byCategory.get(item.category_id);
              const income = category?.type === 'income';
              const Icon = income ? ArrowDownLeft : ArrowUpRight;
              const beneficiary = item.on_behalf_of || item.created_by;
              const attribution =
                showMembers && beneficiary
                  ? [
                      memberName(byMember.get(beneficiary)),
                      item.on_behalf_of && item.created_by
                        ? `por ${memberName(byMember.get(item.created_by))}`
                        : null,
                      item.updated_by && item.updated_by !== item.created_by
                        ? `editado por ${memberName(byMember.get(item.updated_by))}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : '';
              const content = (
                <>
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${income ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block break-words text-sm font-bold">
                      {category?.name ?? 'Categoria indisponível'}
                    </span>
                    {item.description && (
                      <span className="block break-words text-sm text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                    {attribution && (
                      <span className="block break-words text-xs text-muted-foreground">
                        {attribution}
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-sm font-bold tabular-nums ${income ? 'text-green-700' : ''}`}
                  >
                    {money(item.amount_cents, currency)}
                  </span>
                </>
              );
              return (
                <li key={item.id}>
                  {onEdit ? (
                    <Button
                      onClick={() => onEdit(item)}
                      variant="ghost"
                      className="h-auto min-h-12 w-full justify-start gap-3 px-0 py-2 whitespace-normal"
                    >
                      {content}
                    </Button>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3 py-2">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
