-- Add web-only entry points. The existing Contas RPCs retain their contracts.
create function public.create_web_wallet(p_wallet_id uuid, p_name text, p_currency text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  created_id uuid;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_wallet_id is null or p_name is null or char_length(btrim(p_name)) not between 1 and 60
    or p_currency is null or p_currency not in ('BRL', 'USD', 'EUR') then
    raise exception 'invalid wallet details' using errcode = '22023';
  end if;

  -- The existing after-insert trigger creates the initial membership.
  insert into public.wallets (id, name, currency, created_by)
    values (p_wallet_id, btrim(p_name), p_currency, caller)
    on conflict (id) do nothing
    returning id into created_id;

  if created_id is not null then
    return created_id;
  end if;

  -- A retry after a lost response returns the caller's already-created wallet.
  if exists (
    select 1 from public.wallets w
    where w.id = p_wallet_id and w.created_by = caller
      and w.name = btrim(p_name) and w.currency = p_currency
      and public.is_wallet_member(w.id)
  ) then
    return p_wallet_id;
  end if;
  raise exception 'wallet creation conflict' using errcode = '23505';
end;
$$;

create function public.delete_web_personal_wallet(p_wallet_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- A foreign-key insert into wallet_members takes a conflicting key-share lock.
  perform 1 from public.wallets w where w.id = p_wallet_id and w.created_by = caller for update;
  if not found or not exists (
    select 1 from public.wallet_members m where m.wallet_id = p_wallet_id and m.user_id = caller
  ) or exists (
    select 1 from public.wallet_members m where m.wallet_id = p_wallet_id and m.user_id <> caller
  ) then
    raise exception 'wallet is not eligible for personal deletion' using errcode = '42501';
  end if;

  -- Remove dependent rows before wallet cascade reaches RESTRICT foreign keys.
  delete from public.transactions where wallet_id = p_wallet_id;
  delete from public.wallets where id = p_wallet_id;
  return p_wallet_id;
end;
$$;

revoke execute on function public.create_web_wallet(uuid, text, text) from public, anon, service_role;
revoke execute on function public.delete_web_personal_wallet(uuid) from public, anon, service_role;
grant execute on function public.create_web_wallet(uuid, text, text) to authenticated;
grant execute on function public.delete_web_personal_wallet(uuid) to authenticated;

-- Keep the Contas rename and display preference writes. Creator identity
-- remains writable by internal database operations, including FK cleanup.
revoke update on public.wallets from public, anon, authenticated;
revoke update (created_by) on public.wallets from public, anon, authenticated;
grant update (name, show_revenue) on public.wallets to authenticated;

-- Keep historical attribution on ordinary edits after a beneficiary leaves.
-- A new beneficiary or a change of wallet must still pass membership validation.
create or replace function public.tg_transactions_validate_on_behalf_of()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.on_behalf_of = new.created_by then
    new.on_behalf_of := null;
  end if;
  if new.on_behalf_of is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.wallet_id = old.wallet_id and new.on_behalf_of = old.on_behalf_of then
      return new;
    end if;
  end if;
  if not public.is_wallet_member(new.wallet_id, new.on_behalf_of) then
    raise exception 'on_behalf_of must be a member of the wallet';
  end if;
  return new;
end;
$$;

create function public.save_web_transaction(
  p_expected_actor uuid,
  p_transaction_id uuid,
  p_wallet_id uuid,
  p_edit boolean,
  p_draft jsonb
)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  draft public.transactions;
  saved_id uuid;
begin
  if actor is null or actor is distinct from p_expected_actor then
    raise exception 'web_transaction_actor_changed' using errcode = '42501';
  end if;

  draft := pg_catalog.jsonb_populate_record(null::public.transactions, p_draft);
  if not exists (
    select 1 from public.categories c
    where c.id = draft.category_id and c.wallet_id = p_wallet_id
  ) then
    raise exception 'web_transaction_category_unavailable' using errcode = '42501';
  end if;

  if p_edit then
    update public.transactions t
      set category_id = draft.category_id, occurred_at = draft.occurred_at,
        amount_cents = draft.amount_cents, description = draft.description,
        category_item_id = draft.category_item_id,
        on_behalf_of = case when p_draft ? 'on_behalf_of' then draft.on_behalf_of else t.on_behalf_of end
      where t.id = p_transaction_id and t.wallet_id = p_wallet_id and t.status = 'completed'
      returning t.id into saved_id;

    if saved_id is null then
      raise exception 'web_transaction_unavailable' using errcode = '42501';
    end if;
    return saved_id;
  end if;

  insert into public.transactions (
    id, wallet_id, created_by, category_id, occurred_at, amount_cents, description,
    category_item_id, on_behalf_of
  ) values (
    p_transaction_id, p_wallet_id, actor, draft.category_id, draft.occurred_at,
    draft.amount_cents, draft.description, draft.category_item_id, nullif(draft.on_behalf_of, actor)
  ) on conflict (id) do nothing returning id into saved_id;

  if saved_id is not null then
    return saved_id;
  end if;

  if exists (
    select 1 from public.transactions t
    where t.id = p_transaction_id and t.wallet_id = p_wallet_id and t.created_by = actor
      and t.status = 'completed'
      and (t.category_id, t.occurred_at, t.amount_cents, t.description, t.category_item_id, t.on_behalf_of)
        is not distinct from (draft.category_id, draft.occurred_at, draft.amount_cents,
          draft.description, draft.category_item_id, nullif(draft.on_behalf_of, actor))
  ) then
    return p_transaction_id;
  end if;
  raise exception 'web_transaction_retry_conflict' using errcode = '23505';
end;
$$;

revoke execute on function public.save_web_transaction(uuid, uuid, uuid, boolean, jsonb)
  from public, anon, service_role;
grant execute on function public.save_web_transaction(uuid, uuid, uuid, boolean, jsonb)
  to authenticated;
