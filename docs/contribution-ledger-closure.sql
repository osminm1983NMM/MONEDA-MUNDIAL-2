-- Candidate SQL, not automatically deployed. Sandbox MWD only.
begin;
lock table public.mwd_operations in share row exclusive mode;
alter table mwd_finance_private.ledger_transactions drop constraint ledger_transactions_transaction_kind_check;
alter table mwd_finance_private.ledger_transactions add constraint ledger_transactions_transaction_kind_check check (transaction_kind in ('deposit','withdrawal','wallet_transfer','direct_transfer','fee','reversal','demo_contribution'));
create or replace function mwd_finance_private.post_demo_contribution_v1(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare o public.mwd_operations%rowtype; src uuid; dst uuid; tx uuid;
begin
 select * into strict o from public.mwd_operations where id=p_id and kind='contribution';
 if o.source_user_id is null or o.source_user_id is distinct from o.actor_id or o.amount_cents is null or o.amount_cents<=0 then raise exception 'Invalid demo contribution'; end if;
 insert into mwd_finance_private.ledger_accounts(account_code,owner_user_id,currency_code,account_type)
 values ('MWD-DEMO-USER-'||o.source_user_id,o.source_user_id,'MWD','customer_liability'),('MWD-DEMO-CONTRIBUTION-CLEARING',null,'MWD','suspense') on conflict(account_code) do nothing;
 select id into strict src from mwd_finance_private.ledger_accounts where account_code='MWD-DEMO-USER-'||o.source_user_id and owner_user_id=o.source_user_id and currency_code='MWD' and account_type='customer_liability';
 select id into strict dst from mwd_finance_private.ledger_accounts where account_code='MWD-DEMO-CONTRIBUTION-CLEARING' and owner_user_id is null and currency_code='MWD' and account_type='suspense';
 insert into mwd_finance_private.ledger_transactions(external_reference,transaction_kind,currency_code,status) values ('mwd-demo-contribution:'||o.id,'demo_contribution','MWD','draft') on conflict(external_reference) do nothing returning id into tx;
 if tx is null then
 select id into strict tx from mwd_finance_private.ledger_transactions where external_reference='mwd-demo-contribution:'||o.id and transaction_kind='demo_contribution' and currency_code='MWD' and status='posted';
 if (select count(*) from mwd_finance_private.ledger_entries where transaction_id=tx)<>2 or not exists(select 1 from mwd_finance_private.ledger_entries where transaction_id=tx and account_id=src and entry_side='debit' and amount_minor=o.amount_cents) or not exists(select 1 from mwd_finance_private.ledger_entries where transaction_id=tx and account_id=dst and entry_side='credit' and amount_minor=o.amount_cents) then raise exception 'Existing contribution mismatch'; end if;
 return;
 end if;
 insert into mwd_finance_private.ledger_entries(transaction_id,account_id,entry_side,amount_minor) values (tx,src,'debit',o.amount_cents),(tx,dst,'credit',o.amount_cents);
 update mwd_finance_private.ledger_transactions set status='posted' where id=tx;
end $$;
revoke all on function mwd_finance_private.post_demo_contribution_v1(uuid) from public,anon,authenticated;
create or replace function mwd_finance_private.trigger_demo_contribution_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin perform mwd_finance_private.post_demo_contribution_v1(new.id); return new; end $$;
revoke all on function mwd_finance_private.trigger_demo_contribution_v1() from public,anon,authenticated;
drop trigger if exists mwd_auto_ledger_contribution_v1 on public.mwd_operations;
create trigger mwd_auto_ledger_contribution_v1 after insert on public.mwd_operations for each row when (new.kind='contribution') execute function mwd_finance_private.trigger_demo_contribution_v1();
do $$ declare o record; begin for o in select id from public.mwd_operations where kind='contribution' order by id loop perform mwd_finance_private.post_demo_contribution_v1(o.id); end loop; end $$;
-- Review reconciliation and wallet snapshots before committing in an isolated environment.
rollback;
