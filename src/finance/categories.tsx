import { useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { List, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { checked } from './data';
import {
  money,
  periodLabel,
  summarize,
  type Category,
  type Kind,
  type Member,
  type Period,
  type Transaction,
  type Wallet,
} from './model';
import { FinanceState } from './state';
import { TransactionList } from './transactions';

export function KindTabs({
  value,
  onChange,
  noun = false,
}: {
  value: Kind;
  onChange: (value: Kind) => void;
  noun?: boolean;
}) {
  return (
    <Tabs value={value} onValueChange={(value) => onChange(value as Kind)}>
      <TabsList aria-label={noun ? 'Tipo de registro' : 'Tipos de categoria'}>
        <TabsTrigger value="expense">{noun ? 'Despesa' : 'Gastos'}</TabsTrigger>
        <TabsTrigger value="income">{noun ? 'Receita' : 'Entradas'}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export function CategoryForm({
  category,
  type,
  name: initialName = '',
  fixedType,
  online,
  client,
  wallet,
  onCancel,
  onSaved,
}: {
  category?: Category;
  type: Kind;
  name?: string;
  fixedType?: boolean;
  online: boolean;
  client: SupabaseClient;
  wallet: Wallet;
  onCancel: () => void;
  onSaved: (category: Category) => void;
}) {
  const [name, setName] = useState(category?.name ?? initialName);
  const [kind, setKind] = useState(category?.type ?? type);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  async function save(archive?: boolean) {
    if (!online || navigator.onLine === false || saving.current || !name.trim()) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const selected = 'id,name,type,archived_at';
      const query = category
        ? client
            .from('categories')
            .update(
              archive === undefined
                ? { name: name.trim() }
                : { archived_at: archive ? new Date().toISOString() : null },
            )
            .eq('wallet_id', wallet.id)
            .eq('id', category.id)
        : client.from('categories').insert({ wallet_id: wallet.id, name: name.trim(), type: kind });
      onSaved(checked(await query.select(selected).single<Category>()));
    } catch (cause) {
      setError(
        typeof cause === 'object' && cause && 'code' in cause && cause.code === '23505'
          ? 'Já existe uma categoria com esse nome.'
          : 'Não foi possível salvar a categoria. Tente novamente.',
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void save();
  }
  return (
    <form className="space-y-4" onSubmit={submit}>
      {!category && !fixedType && <KindTabs value={kind} onChange={setKind} noun />}
      <Field>
        <FieldLabel htmlFor="category-name">Nome da categoria</FieldLabel>
        <Input
          id="category-name"
          autoFocus
          maxLength={40}
          required
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      {error && <FinanceState kind="error" title="Categoria não salva" description={error} />}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {category && (
          <Button
            type="button"
            className="mr-auto"
            variant="outline"
            disabled={!online || busy}
            onClick={() => void save(!category.archived_at)}
          >
            {category.archived_at ? 'Restaurar' : 'Arquivar'}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!online || busy || !name.trim()}>
          {category ? 'Salvar' : 'Criar categoria'}
        </Button>
      </div>
    </form>
  );
}

export function Categories({
  categories,
  wallet,
  client,
  online,
  rows,
  members,
  period,
  onChange,
}: {
  categories: Category[];
  wallet: Wallet;
  client: SupabaseClient;
  online: boolean;
  rows: Transaction[];
  members: Member[];
  period: Period;
  onChange: () => void;
}) {
  const [kind, setKind] = useState<Kind>('expense');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const activity = summarize(rows);
  const ordered = categories
    .filter((category) => category.type === kind && (showArchived || !category.archived_at))
    .sort(
      (a, b) =>
        (activity.get(b.id)?.amount ?? 0) - (activity.get(a.id)?.amount ?? 0) ||
        a.name.localeCompare(b.name, 'pt-BR'),
    );
  function open(category: Category | 'new') {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(category);
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <KindTabs value={kind} onChange={setKind} />
        <Button variant="outline" disabled={!online} onClick={() => open('new')}>
          <Plus /> Nova categoria
        </Button>
      </div>
      {categories.some((category) => category.type === kind && category.archived_at) && (
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={showArchived}
          onClick={() => setShowArchived((value) => !value)}
        >
          {showArchived ? 'Ocultar arquivadas' : 'Mostrar arquivadas'}
        </Button>
      )}
      {ordered.length === 0 ? (
        <FinanceState
          title="Nenhuma categoria"
          description="Crie uma categoria para organizar suas transações."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {ordered.map((category) => {
            const total = activity.get(category.id);
            const count = total?.count ?? 0;
            return (
              <Card className="min-w-0 py-4" key={category.id}>
                <CardContent className="flex h-full flex-col gap-2">
                  <h2 className="min-w-0 font-bold break-words">{category.name}</h2>
                  <p className="text-sm font-bold tabular-nums">
                    {money(total?.amount ?? 0, wallet.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {count === 1 ? '1 transação' : `${count} transações`}
                    {category.archived_at ? ' · Arquivada' : ''}
                  </p>
                  <div className="mt-auto flex justify-between gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label={`Editar ${category.name}`}
                      onClick={() => open(category)}
                      disabled={!online}
                    >
                      <Pencil />
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          aria-label={`Ver transações de ${category.name}`}
                        >
                          <List />
                        </Button>
                      </DialogTrigger>
                      <DialogContent
                        showCloseButton={false}
                        className="max-h-[85dvh] overflow-y-auto"
                      >
                        <DialogHeader>
                          <DialogTitle>{category.name}</DialogTitle>
                          <DialogDescription>{periodLabel(period)}</DialogDescription>
                        </DialogHeader>
                        {count ? (
                          <TransactionList
                            rows={rows.filter((row) => row.category_id === category.id)}
                            categories={categories}
                            currency={wallet.currency}
                            members={members}
                            showMembers={wallet.memberIds.length > 1}
                          />
                        ) : (
                          <FinanceState
                            title="Nenhuma transação no período"
                            description="Escolha outro período para ver mais registros."
                          />
                        )}
                        <DialogClose asChild>
                          <Button variant="outline">Fechar</Button>
                        </DialogClose>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[85dvh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Nova categoria' : 'Editar categoria'}</DialogTitle>
            <DialogDescription>
              {editing === 'new'
                ? 'Escolha o tipo e dê um nome à categoria.'
                : 'Altere o nome ou gerencie o arquivamento da categoria.'}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <CategoryForm
              category={editing === 'new' ? undefined : editing}
              type="expense"
              wallet={wallet}
              client={client}
              online={online}
              onCancel={() => setEditing(null)}
              onSaved={(category) => {
                setKind(category.type);
                setEditing(null);
                onChange();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
