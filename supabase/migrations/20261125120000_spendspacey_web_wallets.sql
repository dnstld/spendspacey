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
