import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Plus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { checked } from './data';
import { currencies, type Currency, type Wallet } from './model';
import { FinanceState } from './state';

function WalletForm({
  wallet,
  active,
  online,
  onSave,
  onDelete,
  onCancel,
}: {
  wallet?: Wallet;
  active?: boolean;
  online: boolean;
  onSave: (name: string, currency: Currency, id: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(wallet?.name ?? '');
  const [currency, setCurrency] = useState(wallet?.currency ?? 'BRL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const lock = useRef(false);
  const creation = useRef<{ id: string; name: string; currency: Currency } | null>(null);
  async function run(action: () => Promise<void>) {
    if (!online || navigator.onLine === false || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      await action();
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === wallet?.name) return;
    void run(async () => {
      if (
        !wallet &&
        (!creation.current ||
          creation.current.name !== trimmed ||
          creation.current.currency !== currency)
      ) {
        creation.current = { id: crypto.randomUUID(), name: trimmed, currency };
      }
      await onSave(trimmed, currency, wallet?.id ?? creation.current!.id);
    });
  }

  return (
    <Card>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={save}
          aria-label={wallet ? `Gerenciar ${wallet.name}` : 'Criar carteira'}
        >
          {active && <Badge variant="secondary">Carteira ativa</Badge>}
          <Field>
            <FieldLabel>
              Nome da carteira
              <Input
                required
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!online || busy}
              />
            </FieldLabel>
          </Field>
          {wallet ? (
            <Field>
              <FieldLabel>
                Moeda
                <Input value={currency} readOnly />
              </FieldLabel>
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="new-wallet-currency">Moeda</FieldLabel>
              <Select
                value={currency}
                onValueChange={(value) => setCurrency(value as Currency)}
                disabled={!online || busy}
              >
                <SelectTrigger id="new-wallet-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((value) => (
                    <SelectItem value={value} key={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {error && !confirm && (
            <FinanceState
              kind="error"
              title="Carteira não salva"
              description="Confira a conexão e tente novamente."
            />
          )}
          <div className="flex items-center justify-between gap-2">
            {onDelete && (
              <AlertDialog
                open={confirm}
                onOpenChange={(open) => {
                  if (!busy) {
                    setError(false);
                    setConfirm(open);
                  }
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!online || busy}
                    className="text-destructive"
                  >
                    Excluir carteira
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {wallet?.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A carteira e seus registros serão excluídos permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {error && (
                    <FinanceState
                      kind="error"
                      title="Não foi possível excluir a carteira"
                      description="Confirme que esta é uma carteira pessoal e tente novamente."
                    />
                  )}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
                    <Button
                      variant="destructive"
                      disabled={!online || busy}
                      onClick={() => void run(onDelete)}
                    >
                      Excluir carteira
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              className="ml-auto"
              disabled={!online || busy || !name.trim() || name.trim() === wallet?.name}
            >
              {wallet ? 'Salvar' : 'Criar carteira'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function Wallets({
  wallets,
  activeId,
  userId,
  client,
  online,
  change,
  account,
}: {
  wallets: Wallet[];
  activeId?: string;
  userId: string;
  client: SupabaseClient;
  online: boolean;
  change: (id?: string) => void;
  account: ReactNode;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setCreating(true)} disabled={!online || creating}>
          <Plus /> Nova carteira
        </Button>
      </div>
      {creating && (
        <WalletForm
          online={online}
          onCancel={() => setCreating(false)}
          onSave={async (name, currency, id) => {
            const created = checked(
              await client.rpc('create_web_wallet', {
                p_wallet_id: id,
                p_name: name,
                p_currency: currency,
              }),
            );
            change(created);
            setCreating(false);
          }}
        />
      )}
      {wallets.map((wallet) => (
        <WalletForm
          key={wallet.id}
          wallet={wallet}
          active={wallet.id === activeId}
          online={online}
          onSave={async (name) => {
            checked(
              await client
                .from('wallets')
                .update({ name })
                .eq('id', wallet.id)
                .select('id')
                .single(),
            );
            change();
          }}
          onDelete={
            wallet.memberIds.length === 1 && wallet.created_by === userId
              ? async () => {
                  checked(
                    await client.rpc('delete_web_personal_wallet', { p_wallet_id: wallet.id }),
                  );
                  change();
                }
              : undefined
          }
        />
      ))}
      {account}
    </div>
  );
}
