-- Base de datos LOCAL DE CI, sin conexión al Supabase del usuario.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql stable as
  $fn$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $fn$;
grant execute on function auth.uid() to authenticated;

create table public.mwd_wallets(
 user_id uuid primary key, account_code text not null unique);
create table public.mwd_operations(
 id uuid primary key, actor_id uuid not null, request_id uuid not null,
 kind text not null, source_user_id uuid not null, destination_user_id uuid,
 amount_cents bigint not null, created_at timestamptz not null default now());
insert into public.mwd_wallets values
 ('11111111-1111-4111-8111-111111111111','MWD-AAAAAAAAAAAAAAAA'),
 ('22222222-2222-4222-8222-222222222222','MWD-BBBBBBBBBBBBBBBB');
insert into public.mwd_operations
 (id,actor_id,request_id,kind,source_user_id,destination_user_id,amount_cents)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa','transfer',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',100),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-aaaa-4bbb-8bbb-bbbbbbbbbbbb','contribution',
  '11111111-1111-4111-8111-111111111111',null,75);
\ir ../database/mwd_operation_status_demo.sql
do $check$
begin
 if has_function_privilege('anon','public.mwd_operation_status_demo(uuid)','execute')
 or not has_function_privilege('authenticated','public.mwd_operation_status_demo(uuid)','execute')
 then raise exception 'Permisos incorrectos para consulta de operación DEMO'; end if;
end $check$;

set role authenticated;
do $tests$
declare v jsonb;
begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 v:=public.mwd_operation_status_demo('aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa');
 if v->>'status'<>'processed' or v->>'mode'<>'sandbox_only'
 or v->>'recipientCode'<>'MWD-BBBBBBBBBBBBBBBB'
 or v->>'kind'<>'transfer' or (v->>'amountCents')::int<>100
 or (v->>'realPaymentsEnabled')::boolean is distinct from false then
  raise exception 'No coincide transferencia confirmada'; end if;
 v:=public.mwd_operation_status_demo('bbbbbbbb-aaaa-4bbb-8bbb-bbbbbbbbbbbb');
 if v->>'status'<>'processed' or v->>'kind'<>'contribution' or
 v->>'recipientCode' is not null then raise exception 'Aportación inválida'; end if;
 v:=public.mwd_operation_status_demo('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
 if v->>'status'<>'unconfirmed' or v->>'operationId' is not null then
  raise exception 'Referencia desconocida no debe aparecer confirmada'; end if;
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 v:=public.mwd_operation_status_demo('aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa');
 if v->>'status'<>'unconfirmed' or v->>'operationId' is not null then
  raise exception 'Una cuenta pudo consultar operación ajena'; end if;
end $tests$;
reset role;
do $check$
begin
 if (select count(*) from public.mwd_operations)<>2 or
    (select count(*) from public.mwd_wallets)<>2 then
  raise exception 'La función de consulta modificó datos'; end if;
end $check$;
select 'OK: RPC MWD solo consulta, prueba aislada' as resultado;
