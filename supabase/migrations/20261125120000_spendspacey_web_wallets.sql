-- Add web-only entry points and wallet creator records. Existing Contas objects stay untouched.
create schema spendspacey_web;
revoke all on schema spendspacey_web from public, anon, authenticated, service_role;

create table spendspacey_web.wallet_creators (
  wallet_id uuid primary key references public.wallets(id) on delete cascade,
  user_id uuid not null
);
alter table spendspacey_web.wallet_creators enable row level security;
revoke all on spendspacey_web.wallet_creators from public, anon, authenticated, service_role;

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
    insert into spendspacey_web.wallet_creators (wallet_id, user_id)
      values (created_id, caller);
    return created_id;
  end if;

  -- A retry after a lost response returns the caller's already-created wallet.
  if exists (
    select 1 from public.wallets w
    join spendspacey_web.wallet_creators c on c.wallet_id = w.id
    where w.id = p_wallet_id and c.user_id = caller
      and w.name = btrim(p_name) and w.currency = p_currency
      and exists (select 1 from public.wallet_members m where m.wallet_id = w.id and m.user_id = caller)
  ) then
    return p_wallet_id;
  end if;
  raise exception 'wallet creation conflict' using errcode = '23505';
end;
$$;

create function public.list_web_created_wallets()
returns table (wallet_id uuid)
language sql stable security definer set search_path = ''
as $$
  select c.wallet_id
  from spendspacey_web.wallet_creators c
  join public.wallet_members m on m.wallet_id = c.wallet_id and m.user_id = c.user_id
  where c.user_id = auth.uid()
  order by c.wallet_id;
$$;

create function public.list_web_wallet_members(p_wallet_id uuid)
returns table (user_id uuid, display_name text, email text)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, p.display_name, u.email::text
  from public.wallet_members m
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.wallet_id = p_wallet_id and exists (
    select 1 from public.wallet_members caller
    where caller.wallet_id = p_wallet_id and caller.user_id = auth.uid()
  )
  order by m.joined_at, m.user_id;
$$;

create function public.delete_web_personal_wallet(p_wallet_id uuid, p_expected_actor uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null or caller is distinct from p_expected_actor then
    raise exception 'web_wallet_actor_changed' using errcode = '42501';
  end if;

  -- A membership insert takes a conflicting key-share lock through its wallet FK.
  perform 1 from public.wallets w
    join spendspacey_web.wallet_creators c on c.wallet_id = w.id
    where w.id = p_wallet_id and c.user_id = caller
    for update of w;
  if not found then
    raise exception 'web_wallet_not_deletable' using errcode = '42501';
  end if;

  -- Hold the caller's membership until deletion commits.
  perform 1 from public.wallet_members m
    where m.wallet_id = p_wallet_id and m.user_id = caller
    for key share;
  if not found or exists (
    select 1 from public.wallet_members m
    where m.wallet_id = p_wallet_id and m.user_id <> caller
  ) then
    raise exception 'web_wallet_not_deletable' using errcode = '42501';
  end if;

  -- Delete the wallet's transactions before the category cascades reach RESTRICT links.
  delete from public.transactions where wallet_id = p_wallet_id;
  delete from public.wallets where id = p_wallet_id;
  return p_wallet_id;
end;
$$;

revoke execute on function public.create_web_wallet(uuid, text, text) from public, anon, service_role;
revoke execute on function public.list_web_created_wallets() from public, anon, service_role;
revoke execute on function public.list_web_wallet_members(uuid) from public, anon, service_role;
revoke execute on function public.delete_web_personal_wallet(uuid, uuid) from public, anon, service_role;
grant execute on function public.create_web_wallet(uuid, text, text) to authenticated;
grant execute on function public.list_web_created_wallets() to authenticated;
grant execute on function public.list_web_wallet_members(uuid) to authenticated;
grant execute on function public.delete_web_personal_wallet(uuid, uuid) to authenticated;

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
