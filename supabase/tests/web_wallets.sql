-- Run after the Contas migrations and the Spendspacey wallet migration
-- on a disposable database. The test transaction rolls back all fixtures.
begin;

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'owner@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'member@example.test');

do $$
begin
  if has_function_privilege('anon', 'public.create_web_wallet(uuid,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.delete_web_personal_wallet(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.save_web_transaction(uuid,uuid,uuid,boolean,jsonb)', 'EXECUTE') then
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
  update public.wallets set name = 'Renamed', show_revenue = true where id = wallet_id;
  if not exists (select 1 from public.wallets where id = wallet_id and name = 'Renamed' and show_revenue) then
    raise exception 'Contas rename or display preference was denied';
  end if;
  begin
    update public.wallets set created_by = auth.uid() where id = wallet_id;
    raise exception 'Client could replace the wallet creator';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.delete_web_personal_wallet(wallet_id);
    raise exception 'Non-owner could delete the wallet';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;
insert into public.categories (id, wallet_id, name, type) values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'Histórico', 'expense');
insert into public.transactions (id, wallet_id, category_id, amount_cents, occurred_at, created_by, on_behalf_of) values (
  '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004',
  '40000000-0000-4000-8000-000000000001', 100, '2026-11-25',
  '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'
);
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
  target_transaction uuid := '30000000-0000-4000-8000-000000000001';
  historical_transaction uuid := '30000000-0000-4000-8000-000000000002';
  owner uuid := auth.uid();
  other_member uuid := '10000000-0000-4000-8000-000000000002';
  draft jsonb;
begin
  insert into public.categories (wallet_id, name, type) values (target_wallet, 'Mercado', 'expense') returning id into target_category;
  insert into public.category_items (wallet_id, category_id, name, default_amount_cents)
    values (target_wallet, target_category, 'Compras', 1200) returning id into target_item;
  draft := jsonb_build_object(
    'category_id', target_category, 'category_item_id', target_item, 'occurred_at', '2026-11-25',
    'amount_cents', 1200, 'description', 'Compras', 'on_behalf_of', null, 'created_by', other_member
  );
  begin
    perform public.save_web_transaction(other_member, target_transaction, target_wallet, false, draft);
    raise exception 'Transaction save accepted the wrong actor';
  exception when insufficient_privilege then null;
  end;
  if public.save_web_transaction(owner, target_transaction, target_wallet, false, draft) <> target_transaction
    or public.save_web_transaction(owner, target_transaction, target_wallet, false, draft) <> target_transaction then
    raise exception 'Save or identical retry did not return the saved transaction';
  end if;
  if not exists (select 1 from public.transactions where id = target_transaction and created_by = owner) then
    raise exception 'Saved transaction was not bound to the authenticated actor';
  end if;
  begin
    perform public.save_web_transaction(owner, target_transaction, target_wallet, false, draft || '{"amount_cents":1300}');
    raise exception 'A changed draft was reported saved on a retry';
  exception when unique_violation then
    if sqlerrm <> 'web_transaction_retry_conflict' then raise; end if;
  end;
  perform public.save_web_transaction(owner, target_transaction, target_wallet, true, draft || '{"amount_cents":1400}');
  if not exists (select 1 from public.transactions where id = target_transaction and amount_cents = 1400) then
    raise exception 'An explicit edit did not update the transaction';
  end if;
  perform public.save_web_transaction(owner, historical_transaction, target_wallet, true,
    (draft - 'on_behalf_of') || '{"amount_cents":1500}');
  if not exists (
    select 1 from public.transactions where id = historical_transaction
      and amount_cents = 1500 and on_behalf_of = other_member
  ) then
    raise exception 'An ordinary edit lost the historical beneficiary';
  end if;
  begin
    perform public.save_web_transaction(owner, target_transaction, target_wallet, true,
      draft || jsonb_build_object('on_behalf_of', other_member));
    raise exception 'An edit assigned a new departed beneficiary';
  exception when raise_exception then
    if sqlerrm <> 'on_behalf_of must be a member of the wallet' then raise; end if;
  end;
  begin
    perform public.save_web_transaction(owner, gen_random_uuid(), target_wallet, false,
      draft || jsonb_build_object('on_behalf_of', other_member));
    raise exception 'A new transaction assigned a departed beneficiary';
  exception when raise_exception then
    if sqlerrm <> 'on_behalf_of must be a member of the wallet' then raise; end if;
  end;
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
