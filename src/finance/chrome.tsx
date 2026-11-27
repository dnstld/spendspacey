import { ContasMark } from '@/components/ContasMark';
import { useState } from 'react';
import { CalendarDays, List, Plus, Shapes, Wallet as WalletIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { monthLabels, periodLabel, shortcuts, type Period, type View, type Wallet } from './model';

function PeriodPicker({
  period,
  onChange,
  firstYear,
}: {
  period: Period;
  onChange: (period: Period) => void;
  firstYear: number;
}) {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const years = Array.from(
    { length: currentYear - Math.min(firstYear, currentYear - 1) + 1 },
    (_, i) => currentYear - i,
  );
  function choose(value: Period) {
    onChange(value);
    setOpen(false);
  }
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        if (value) setYear(typeof period === 'object' ? period.year : currentYear);
        setOpen(value);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="min-h-11 shrink-0"
          aria-label={`Selecionar período, ${periodLabel(period)}`}
        >
          <CalendarDays aria-hidden="true" /> {periodLabel(period)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] space-y-4">
        <div className="grid grid-cols-2 gap-2" aria-label="Períodos rápidos">
          {(Object.keys(shortcuts) as (keyof typeof shortcuts)[]).map((shortcut) => (
            <Button
              key={shortcut}
              variant={period === shortcut ? 'default' : 'outline'}
              onClick={() => choose(shortcut)}
            >
              {shortcuts[shortcut]}
            </Button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger aria-label="Ano">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {years.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => choose({ year })}>
            Ano todo
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {monthLabels.map((label, month) => (
            <Button
              key={label}
              variant={
                typeof period === 'object' && period.year === year && period.month === month
                  ? 'default'
                  : 'ghost'
              }
              onClick={() => choose({ year, month })}
            >
              {label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FinanceHeader({
  view,
  wallets,
  active,
  onWallet,
  period,
  onPeriod,
  firstYear,
}: {
  view: View;
  wallets: Wallet[];
  active?: Wallet;
  onWallet: (id: string) => void;
  period: Period;
  onPeriod: (period: Period) => void;
  firstYear: number;
}) {
  return (
    <header className="finance-header fixed inset-x-0 top-0 z-30 border-b bg-background">
      <div className="finance-column flex h-[4.5rem] items-center justify-between gap-3">
        <ContasMark className="size-8 shrink-0 rounded-md" alt="Spendspacey" />
        <div className="flex min-w-0 items-center gap-2">
          {active && (
            <Select value={active.id} onValueChange={onWallet}>
              <SelectTrigger className="min-h-11 min-w-0" aria-label="Carteira ativa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {wallets.map(({ id, name }) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {view !== 'wallets' && (
            <PeriodPicker period={period} onChange={onPeriod} firstYear={firstYear} />
          )}
        </div>
      </div>
    </header>
  );
}

const links = [
  { id: 'transactions', label: 'Transações', Icon: List },
  { id: 'categories', label: 'Categorias', Icon: Shapes },
  { id: 'wallets', label: 'Carteiras', Icon: WalletIcon },
] as const;

export function FinanceDock({
  view,
  onNavigate,
  onAdd,
  canAdd,
}: {
  view: View;
  onNavigate: (view: View) => void;
  onAdd: () => void;
  canAdd: boolean;
}) {
  return (
    <div className="finance-dock pointer-events-none fixed inset-x-0 z-30 flex items-center justify-center gap-2 px-4">
      <nav
        aria-label="Menu principal"
        className="pointer-events-auto flex gap-1 rounded-full border bg-card p-1.5 shadow-lg"
      >
        {links.map(({ id, label, Icon }) => (
          <Button
            key={id}
            variant={view === id ? 'secondary' : 'ghost'}
            className="min-h-11 min-w-11 rounded-full"
            aria-label={label}
            aria-current={view === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon aria-hidden="true" /> <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
      </nav>
      {view === 'transactions' && (
        <Button
          aria-label="Nova transação"
          className="pointer-events-auto size-12 rounded-full shadow-lg"
          size="icon"
          disabled={!canAdd}
          onClick={onAdd}
        >
          <Plus aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
