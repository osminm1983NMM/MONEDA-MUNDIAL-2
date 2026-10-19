\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
grant execute on function auth.uid() to authenticated;

create table public.mwd_wallets(user_id uuid primary key,
 account_code text unique not null, balance_cents bigint not null);
create table public.mwd_operations(id uuid primary key default gen_random_uuid(),
 actor_id uuid not null,request_id uuid not null,kind text not null,
 source_user_id uuid not null,destination_user_id uuid,
 amount_cents bigint not null,created_at timestamptz not null default now(),
 unique(actor_id,request_id));
insert into public.mwd_wallets values
 ('11111111-1111-4111-8111-111111111111','MWD-AAAAAAAAAAAAAAAA',100000),
 ('22222222-2222-4222-8222-222222222222','MWD-BBBBBBBBBBBBBBBB',200000);
\ir fixtures/mwd-core-rpcs-snapshot-demo.sql
\ir ../database/mwd_operation_status_demo.sql

set role authenticated;
do $checks$
declare
  first_result jsonb;
  second_result jsonb;
  checked jsonb;
  request_id uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
begin
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  checked:=public.mwd_operation_status_demo(request_id);
  if checked->>'status'<>'unconfirmed' then raise exception 'Referencia inicial no disponible'; end if;
  first_result:=public.mwd_transfer_demo('MWD-BBBBBBBBBBBBBBBB',1000,request_id);
  second_result:=public.mwd_transfer_demo('MWD-BBBBBBBBBBBBBBBB',1000,request_id);
  if first_result->>'status'<>'ok' or second_result->>'status'<>'already_processed'
    or first_result->>'operation_id' is distinct from second_result->>'operation_id'
    then raise exception 'Error de idempotencia de transferencia'; end if;
  checked:=public.mwd_operation_status_demo(request_id);
  if checked->>'status'<>'processed'
    or checked->>'operationId' is distinct from first_result->>'operation_id'
    or checked->>'recipientCode'<>'MWD-BBBBBBBBBBBBBBBB'
    then raise exception 'Error de conciliación'; end if;
  if (select balance_cents from public.mwd_wallets where account_code='MWD-AAAAAAAAAAAAAAAA')<>99000
    or (select balance_cents from public.mwd_wallets where account_code='MWD-BBBBBBBBBBBBBBBB')<>201000
    or (select count(*) from public.mwd_operations where request_id=request_id)<>1
    then raise exception 'La transferencia se duplicó'; end if;
  perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
  checked:=public.mwd_operation_status_demo(request_id);
  if checked->>'status'<>'unconfirmed' then raise exception 'Lectura ajena permitida'; end if;
end $checks$;
reset role;
select 'OK: dos cuentas y transferencia ficticia única' as resultado;
