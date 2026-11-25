import { CircleAlert, ReceiptText, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export function FinanceState({
  kind = 'empty',
  title,
  description,
  action,
}: {
  kind?: 'empty' | 'error' | 'offline';
  title: string;
  description: string;
  action?: { label: string; run: () => void };
}) {
  const Icon = { empty: ReceiptText, error: CircleAlert, offline: WifiOff }[kind];
  return (
    <Empty role={kind === 'empty' ? undefined : 'status'} className="min-h-52">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-14 rounded-2xl">
          <Icon aria-hidden="true" className="size-7" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && (
        <EmptyContent>
          <Button onClick={action.run}>{action.label}</Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

export function LoadError({ retry }: { retry: () => void }) {
  return (
    <FinanceState
      kind="error"
      title="Não foi possível carregar"
      description="Confira a conexão e tente carregar novamente."
      action={{ label: 'Tentar novamente', run: retry }}
    />
  );
}
