import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { CategoryForm, KindTabs } from './categories';
import { checked, readDuplicates } from './data';
import {
  dateKey,
  memberName,
  money,
  type Category,
  type CategoryItem,
  type Kind,
  type Member,
  type Transaction,
  type Wallet,
} from './model';
import { FinanceState } from './state';
import { TransactionList } from './transactions';

type Step = 'form' | 'category' | 'new-category' | 'item' | 'duplicate';
const starters = {
  expense: ['Mercado', 'Alimentação', 'Transporte', 'Moradia', 'Saúde'],
  income: ['Salário', 'Reembolso', 'Freelance', 'Investimentos'],
};

function filterName(name: string) {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

export function TransactionForm({
  current,
  categories: initialCategories,
  items: initialItems,
  members,
  wallet,
  userId,
  online,
  authorized,
  accountIsCurrent,
  client,
  rankedRows,
  close,
  onSaved,
  onMembershipChanged,
}: {
  current?: Transaction;
  categories: Category[];
  items: CategoryItem[];
  members: Member[];
  wallet: Wallet;
  userId: string;
  online: boolean;
  authorized: boolean;
  accountIsCurrent: () => boolean;
  client: SupabaseClient;
  rankedRows: Transaction[];
  close: () => void;
  onSaved: () => void;
  onMembershipChanged: () => void;
}) {
  const [kind, setKind] = useState<Kind>(
    initialCategories.find((category) => category.id === current?.category_id)?.type ?? 'expense',
  );
  const [categoryId, setCategoryId] = useState(current?.category_id ?? '');
  const [itemId, setItemId] = useState<string | null>(current?.category_item_id ?? null);
  const [day, setDay] = useState(current?.occurred_at ?? dateKey(new Date()));
  const [amount, setAmount] = useState(current?.amount_cents ?? 0);
  const [chosenBeneficiary, setBeneficiary] = useState<string>();
  const beneficiary = chosenBeneficiary ?? current?.on_behalf_of ?? current?.created_by ?? userId;
  const unavailableBeneficiary =
    online &&
    !!chosenBeneficiary &&
    !members.some((member) => member.user_id === chosenBeneficiary);
  const historicalBeneficiary =
    online &&
    !chosenBeneficiary &&
    !!current?.on_behalf_of &&
    !members.some((member) => member.user_id === current.on_behalf_of);
  const [description, setDescription] = useState(current?.description ?? '');
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [step, setStep] = useState<Step>('form');
  const [search, setSearch] = useState('');
  const [duplicates, setDuplicates] = useState<Transaction[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'failed' | 'conflict' | 'beneficiary' | null>(null);
  const pending = useRef(false);
  const activeWrite = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    const cancel = () => activeWrite.current?.abort();
    window.addEventListener('offline', cancel);
    return () => {
      window.removeEventListener('offline', cancel);
      cancel();
    };
  }, [online, authorized]);
  const creationId = useRef(crypto.randomUUID());
  const category = categories.find((value) => value.id === categoryId);
  const categoryUsage = new Map<string, number>();
  const itemUsage = new Map<string, number>();
  for (const row of rankedRows) {
    categoryUsage.set(row.category_id, (categoryUsage.get(row.category_id) ?? 0) + 1);
    if (row.category_item_id)
      itemUsage.set(row.category_item_id, (itemUsage.get(row.category_item_id) ?? 0) + 1);
  }
  const matchingCategories = categories
    .filter((value) => value.type === kind && !value.archived_at)
    .sort(
      (a, b) =>
        (categoryUsage.get(b.id) ?? 0) - (categoryUsage.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name, 'pt-BR'),
    );
  const matchingItems = items
    .filter((value) => value.category_id === categoryId && !value.archived_at)
    .sort(
      (a, b) =>
        (itemUsage.get(b.id) ?? 0) - (itemUsage.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name, 'pt-BR'),
    );
  const query = filterName(search.trim());
  const itemName = search.trim().toLocaleLowerCase('pt-BR');
  const exactItem = items.find(
    (value) =>
      value.category_id === categoryId && value.name.toLocaleLowerCase('pt-BR') === itemName,
  );
  const filtered = matchingCategories.filter((value) => filterName(value.name).includes(query));
  const archived = categories.filter(
    (value) => value.type === kind && value.archived_at && filterName(value.name).includes(query),
  );
  const mostUsed = filtered.filter((value) => categoryUsage.has(value.id)).slice(0, 5);
  const rest = filtered.filter((value) => !mostUsed.includes(value));
  const canSave =
    online && authorized && !!category && !!day && amount > 0 && !busy && !unavailableBeneficiary;

  function move(next: Step, value = '') {
    setError(null);
    setSearch(value);
    setStep(next);
  }
  function selectCategory(value: Category) {
    if (categoryId !== value.id) setItemId(null);
    setCategoryId(value.id);
    move('form');
  }
  function selectItem(value: CategoryItem) {
    setItemId(value.id);
    setDescription(value.name);
    if (!amount && value.default_amount_cents) setAmount(value.default_amount_cents);
    move('form');
  }
  function canWrite(signal?: AbortSignal) {
    return (
      online && authorized && navigator.onLine !== false && accountIsCurrent() && !signal?.aborted
    );
  }
  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (!canWrite() || pending.current) return;
    const controller = new AbortController();
    activeWrite.current = controller;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action(controller.signal);
    } catch (cause) {
      if (controller.signal.aborted) return;
      const message =
        cause && typeof cause === 'object' && 'message' in cause ? cause.message : undefined;
      if (message === 'on_behalf_of must be a member of the wallet') {
        setError('beneficiary');
        onMembershipChanged();
      } else {
        setError(message === 'web_transaction_retry_conflict' ? 'conflict' : 'failed');
      }
    } finally {
      activeWrite.current = null;
      pending.current = false;
      setBusy(false);
    }
  }
  function save(confirmed = false) {
    if (!canSave) return;
    void run(async (signal) => {
      if (!current && !confirmed) {
        const matches = (
          await readDuplicates(client, wallet.id, categoryId, day, amount, signal)
        ).filter((value) => value.id !== creationId.current);
        if (!canWrite(signal)) return;
        if (matches.length) {
          setDuplicates(matches);
          move('duplicate');
          return;
        }
      }
      if (!canWrite(signal)) return;
      const transactionId = current?.id ?? creationId.current;
      const saved = checked(
        await client
          .rpc('save_web_transaction', {
            p_expected_actor: userId,
            p_transaction_id: transactionId,
            p_wallet_id: wallet.id,
            p_edit: !!current,
            p_draft: {
              category_id: categoryId,
              occurred_at: day,
              amount_cents: amount,
              description: description.trim(),
              category_item_id: itemId,
              ...(!current || chosenBeneficiary !== undefined
                ? {
                    on_behalf_of:
                      beneficiary === (current ? current.created_by : userId) ? null : beneficiary,
                  }
                : {}),
            },
          })
          .abortSignal(signal),
      );
      if (!canWrite(signal)) return;
      if (saved !== transactionId) throw new Error('Transação indisponível.');
      onSaved();
      close();
    });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    save();
  }

  function categoryChoices(values: Category[]) {
    return values.map((value) => (
      <Button
        key={value.id}
        type="button"
        variant="ghost"
        className="h-auto min-h-10 justify-start whitespace-normal"
        onClick={() => selectCategory(value)}
      >
        {value.name}
      </Button>
    ));
  }
  const title = {
    form: current ? 'Editar transação' : 'Nova transação',
    category: 'Escolher categoria',
    'new-category': 'Nova categoria',
    item: 'Para quê?',
    duplicate: 'Possível duplicidade',
  }[step];
  if (online && !authorized) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] overflow-y-auto"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {step === 'duplicate'
              ? 'Já existe um registro com a mesma data, categoria e valor.'
              : wallet.name}
          </DialogDescription>
        </DialogHeader>
        {!online && (
          <p role="status" className="text-sm text-muted-foreground">
            Você está offline. Reconecte-se para salvar alterações.
          </p>
        )}
        {error && (
          <FinanceState
            kind="error"
            title="Não foi possível concluir"
            description={
              error === 'conflict'
                ? 'Já existe uma versão salva desta transação. Feche o rascunho e abra a transação na lista para alterá-la.'
                : error === 'beneficiary'
                  ? 'A lista de participantes mudou. Confira o beneficiário e tente novamente.'
                  : 'Seu rascunho continua aqui. Confira a conexão e tente novamente.'
            }
            action={
              error === 'conflict'
                ? {
                    label: 'Voltar à lista',
                    run: () => {
                      onSaved();
                      close();
                    },
                  }
                : undefined
            }
          />
        )}
        {step === 'form' && (
          <form className="space-y-5" onSubmit={submit}>
            <KindTabs
              value={kind}
              noun
              onChange={(value) => {
                setKind(value);
                setCategoryId('');
                setItemId(null);
              }}
            />
            <Field>
              <FieldLabel htmlFor="transaction-date">Data</FieldLabel>
              <Input
                id="transaction-date"
                type="date"
                required
                value={day}
                onChange={(event) => setDay(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="transaction-amount">Valor</FieldLabel>
              <div className="relative">
                <Input
                  id="transaction-amount"
                  className="h-12 text-transparent caret-transparent"
                  inputMode="numeric"
                  value={amount ? String(amount) : ''}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) =>
                    setAmount(Number(event.target.value.replace(/\D/g, '').slice(0, 12)))
                  }
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xl tabular-nums"
                >
                  {money(amount, wallet.currency)}
                </span>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="transaction-category">
                {kind === 'income' ? 'Entradas' : 'Gastos'}
              </FieldLabel>
              <Button
                type="button"
                id="transaction-category"
                aria-label={
                  category ? `Selecionar categoria, ${category.name}` : 'Selecionar categoria'
                }
                variant="outline"
                className="justify-between"
                onClick={() => move('category')}
              >
                <span className="truncate">{category?.name || 'Selecionar categoria'}</span>
                <ChevronRight />
              </Button>
              <div className="flex flex-wrap gap-2">
                {matchingCategories.slice(0, 5).map((value) => (
                  <Button
                    key={value.id}
                    type="button"
                    size="sm"
                    variant={categoryId === value.id ? 'secondary' : 'outline'}
                    onClick={() => selectCategory(value)}
                  >
                    {value.name}
                  </Button>
                ))}
                {!matchingCategories.length &&
                  starters[kind].map((value) => (
                    <Button
                      type="button"
                      key={value}
                      size="sm"
                      variant="outline"
                      disabled={!online}
                      onClick={() => move('new-category', value)}
                    >
                      {value}
                    </Button>
                  ))}
              </div>
            </Field>
            {(members.length > 1 || unavailableBeneficiary || historicalBeneficiary) && (
              <Field>
                <span className="text-sm font-medium">Em nome de</span>
                {unavailableBeneficiary && (
                  <p role="alert">
                    O beneficiário selecionado saiu da carteira. Selecione um participante atual.
                  </p>
                )}
                {historicalBeneficiary && (
                  <p role="status">
                    O beneficiário original saiu da carteira. Ele será mantido se você não escolher
                    outro participante.
                  </p>
                )}
                <div className="flex flex-wrap gap-2" role="group" aria-label="Em nome de">
                  {members.map((value) => (
                    <Button
                      type="button"
                      key={value.user_id}
                      size="sm"
                      variant={beneficiary === value.user_id ? 'secondary' : 'outline'}
                      aria-pressed={beneficiary === value.user_id}
                      onClick={() => {
                        setBeneficiary(value.user_id);
                        setError(null);
                      }}
                    >
                      {value.user_id === userId ? 'Eu' : memberName(value)}
                    </Button>
                  ))}
                </div>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="transaction-description">Para quê?</FieldLabel>
              <Button
                type="button"
                id="transaction-description"
                aria-label={description ? `Para quê? ${description}` : 'Adicionar descrição'}
                variant="outline"
                className="justify-between"
                disabled={!categoryId}
                onClick={() => move('item', description)}
              >
                <span className="truncate">{description || 'Adicionar descrição'}</span>
                <ChevronRight />
              </Button>
              {!!matchingItems.length && (
                <div className="flex flex-wrap gap-2">
                  {matchingItems.slice(0, 5).map((value) => (
                    <Button
                      type="button"
                      key={value.id}
                      size="sm"
                      variant={itemId === value.id ? 'secondary' : 'outline'}
                      onClick={() => selectItem(value)}
                    >
                      {value.name}
                    </Button>
                  ))}
                </div>
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close} disabled={busy}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!canSave}>
                {busy ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </form>
        )}
        {step === 'category' && (
          <div className="space-y-3">
            <Input
              autoFocus
              aria-label="Buscar categoria"
              placeholder="Buscar categoria"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button
              variant="outline"
              disabled={!online}
              onClick={() => move('new-category', search)}
            >
              <Plus /> Nova categoria
            </Button>
            {!!mostUsed.length && (
              <div className="grid">
                <h3 className="text-sm font-bold">Mais usadas</h3>
                {categoryChoices(mostUsed)}
              </div>
            )}
            {!!rest.length && (
              <div className="grid">
                <h3 className="text-sm font-bold">Categorias</h3>
                {categoryChoices(rest)}
              </div>
            )}
            {!!archived.length && (
              <div className="grid">
                <h3 className="text-sm font-bold">Arquivadas</h3>
                {archived.map((value) => (
                  <Button
                    key={value.id}
                    variant="ghost"
                    className="justify-start"
                    disabled={!online || busy}
                    onClick={() =>
                      void run(async () => {
                        const restored = checked(
                          await client
                            .from('categories')
                            .update({ archived_at: null })
                            .eq('wallet_id', wallet.id)
                            .eq('id', value.id)
                            .select('id,name,type,archived_at')
                            .single<Category>(),
                        );
                        setCategories((list) =>
                          list.map((entry) => (entry.id === restored.id ? restored : entry)),
                        );
                        selectCategory(restored);
                        onSaved();
                      })
                    }
                  >
                    {value.name} · Restaurar
                  </Button>
                ))}
              </div>
            )}
            {!filtered.length && !archived.length && (
              <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>
            )}
            <Button variant="ghost" onClick={() => move('form')}>
              Voltar
            </Button>
          </div>
        )}
        {step === 'new-category' && (
          <CategoryForm
            type={kind}
            fixedType
            wallet={wallet}
            client={client}
            name={search}
            online={online}
            onCancel={() => move('category')}
            onSaved={(value) => {
              setCategories((list) => [...list, value]);
              selectCategory(value);
              onSaved();
            }}
          />
        )}
        {step === 'item' && (
          <div className="space-y-3">
            <Input
              autoFocus
              aria-label="Descrição"
              placeholder="Buscar ou digitar descrição"
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="grid">
              {matchingItems
                .filter((value) => filterName(value.name).includes(query))
                .map((value) => (
                  <Button
                    key={value.id}
                    variant="ghost"
                    className="justify-between"
                    onClick={() => selectItem(value)}
                  >
                    <span className="truncate">{value.name}</span>
                    {value.default_amount_cents
                      ? money(value.default_amount_cents, wallet.currency)
                      : null}
                  </Button>
                ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => move('form')}>
                Voltar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setItemId(null);
                  setDescription(search.trim());
                  move('form');
                }}
              >
                Usar descrição
              </Button>
              {itemName && (!exactItem || exactItem.archived_at) && (
                <Button
                  disabled={!online || busy || search.trim().length > 40}
                  onClick={() =>
                    void run(async () => {
                      const fields = 'id,category_id,name,default_amount_cents,archived_at';
                      const write = exactItem
                        ? client
                            .from('category_items')
                            .update({ archived_at: null })
                            .eq('wallet_id', wallet.id)
                            .eq('category_id', categoryId)
                            .eq('id', exactItem.id)
                        : client.from('category_items').insert({
                            wallet_id: wallet.id,
                            category_id: categoryId,
                            name: search.trim(),
                          });
                      const saved = checked(await write.select(fields).single<CategoryItem>());
                      setItems((list) => [...list.filter((item) => item.id !== saved.id), saved]);
                      selectItem(saved);
                      onSaved();
                    })
                  }
                >
                  {exactItem ? 'Restaurar e usar' : 'Salvar para reutilizar'}
                </Button>
              )}
            </div>
          </div>
        )}
        {step === 'duplicate' && (
          <>
            <TransactionList
              rows={duplicates}
              categories={categories}
              currency={wallet.currency}
              members={members}
              showMembers={wallet.memberIds.length > 1}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => move('form')}>
                Voltar
              </Button>
              <Button disabled={!canSave} onClick={() => save(true)}>
                Salvar mesmo assim
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
