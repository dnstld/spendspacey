-- Run after the Contas migrations and the Spendspacey wallet migration
-- on a disposable database. The test transaction rolls back all fixtures.
begin;

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'owner@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'member@example.test');

do $$
begin
  if has_function_privilege('anon', 'public.create_web_wallet(uuid,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.delete_web_personal_wallet(uuid)', 'EXECUTE') then
    raise exception 'Anonymous callers have access';
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

do $$
declare
  wallet_id uuid := '20000000-0000-4000-8000-000000000004';
begin
  perform public.create_wallet('Primeira', 'BRL');
  perform public.create_wallet('Segunda', 'USD');
  perform public.create_wallet('Terceira', 'EUR');
  begin
    perform public.create_wallet('Legacy cap', 'BRL');
    raise exception 'Legacy cap missing';
  exception when raise_exception then
    if sqlerrm <> 'free_tier_limit' then raise; end if;
  end;

  if public.create_web_wallet(wallet_id, 'Quarta', 'EUR') <> wallet_id
    or public.create_web_wallet(wallet_id, 'Quarta', 'EUR') <> wallet_id then
    raise exception 'Creation or retry did not return the wallet';
  end if;
  if not exists (select 1 from public.wallets where id = wallet_id and currency = 'EUR')
    or not public.is_wallet_member(wallet_id) then
    raise exception 'Creation did not set currency and initial membership';
  end if;
  begin
    perform public.create_web_wallet(gen_random_uuid(), 'Inválida', 'GBP');
    raise exception 'Invalid currency accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    update public.wallets set currency = 'USD' where id = wallet_id;
    raise exception 'Currency was changeable';
  exception when others then
    if sqlerrm = 'Currency was changeable' then raise; end if;
  end;
end
$$;

reset role;

insert into public.wallet_members (wallet_id, user_id) values
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002');

set local role authenticated;
do $$
declare
  wallet_id uuid := '20000000-0000-4000-8000-000000000004';
begin
  begin
    perform public.delete_web_personal_wallet(wallet_id);
    raise exception 'Shared owner could delete the wallet';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
  begin
    perform public.delete_web_personal_wallet(wallet_id);
    raise exception 'Non-owner could delete the wallet';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;
delete from public.wallet_members
where wallet_id = '20000000-0000-4000-8000-000000000004'
  and user_id = '10000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

do $$
declare
  target_wallet uuid := '20000000-0000-4000-8000-000000000004';
  target_category uuid;
  target_item uuid;
begin
  insert into public.categories (wallet_id, name, type) values (target_wallet, 'Mercado', 'expense') returning id into target_category;
  insert into public.category_items (wallet_id, category_id, name, default_amount_cents)
    values (target_wallet, target_category, 'Compras', 1200) returning id into target_item;
  insert into public.transactions (wallet_id, category_id, category_item_id, amount_cents, occurred_at, created_by)
    values (target_wallet, target_category, target_item, 1200, '2026-11-25', auth.uid());
  if public.delete_web_personal_wallet(target_wallet) <> target_wallet then
    raise exception 'Personal deletion failed';
  end if;
end
$$;

reset role;
do $$
begin
  if exists (select 1 from public.wallets where id = '20000000-0000-4000-8000-000000000004') then
    raise exception 'Personal wallet remains after deletion';
  end if;
end
$$;

rollback;
