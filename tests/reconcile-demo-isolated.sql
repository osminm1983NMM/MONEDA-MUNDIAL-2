-- Ensayo AISLADO en PostgreSQL desechable, jamás en el proyecto Supabase real.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to authenticated;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $fn$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $fn$;
grant execute on function auth.uid() to authenticated;
insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

\ir ../database/mwd_coin_stable_conversion_demo.sql
\ir ../database/mwd_conversion_reconcile_demo.sql

-- Una cotización vigente, otra vencida y una ya ejecutada.
insert into mwd_swap_private.demo_quotes
(id,user_id,client_request_id,from_asset,to_asset,amount_in_micro,
 gross_out_micro,fee_out_micro,amount_out_micro,stable_per_coin,status,expires_at)
values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa','COIN','STABLE',1000000,
 125000,313,124687,0.125,'quoted',now()+interval '60 seconds'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111',
 'bbbbbbbb-aaaa-4bbb-8bbb-bbbbbbbbbbbb','COIN','STABLE',1000000,
 125000,313,124687,0.125,'quoted',now()-interval '60 seconds'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111',
 'cccccccc-aaaa-4ccc-8ccc-cccccccccccc','COIN','STABLE',1000000,
 125000,313,124687,0.125,'executed',now()-interval '60 seconds');

insert into mwd_swap_private.demo_conversions
 (id,quote_id,user_id,from_asset,to_asset,amount_in_micro,amount_out_micro,fee_out_micro,stable_per_coin)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 '11111111-1111-4111-8111-111111111111','COIN','STABLE',1000000,124687,313,0.125);

do $test$
begin
 if has_function_privilege('anon','public.mwd_conversion_reconcile_demo(uuid)','execute')
    or not has_function_privilege('authenticated','public.mwd_conversion_reconcile_demo(uuid)','execute')
 then raise exception 'ALERTA: permisos del RPC de conciliación incorrectos'; end if;
end $test$;

set role authenticated;
-- Todas las respuestas incluyen bandera SIN DINERO REAL y pertenecen a la sesión.
do $test$
declare
  q jsonb;
  before_q integer;
begin
 perform pg_catalog.set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
 q:=public.mwd_conversion_reconcile_demo('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 if q->>'status'<>'quoted' or q->>'conversionId' is not null
    or q->>'mode'<>'sandbox_only' or (q->>'realPaymentsEnabled')::boolean<>false
 then raise exception 'ALERTA: cotización vigente no conciliada correctamente'; end if;
 q:=public.mwd_conversion_reconcile_demo('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 if q->>'status'<>'expired' or q->>'conversionId' is not null
 then raise exception 'ALERTA: cotización vencida no conciliada correctamente'; end if;
 q:=public.mwd_conversion_reconcile_demo('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
 if q->>'status'<>'executed'
    or q->>'conversionId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 then raise exception 'ALERTA: cotización ejecutada sin referencia correcta'; end if;

 perform pg_catalog.set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
 begin
  perform public.mwd_conversion_reconcile_demo('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  raise exception 'ALERTA: usuario pudo leer conversión ajena';
 exception when invalid_parameter_value then null;
 end;
 perform pg_catalog.set_config('request.jwt.claim.sub','',false);
 begin
  perform public.mwd_conversion_reconcile_demo('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  raise exception 'ALERTA: visitante pudo leer conversión';
 exception when insufficient_privilege then null;
 end;
end $test$;
reset role;

-- Conciliar no crea asientos, no cambia cotizaciones, no cambia saldos.
do $test$
begin
 if (select count(*) from mwd_swap_private.demo_conversions) <> 1 or
    (select count(*) from mwd_swap_private.demo_quotes where status='executed')<>1 or
    (select count(*) from mwd_swap_private.demo_journal)<>0 or
    (select count(*) from mwd_swap_private.demo_balances)<>0
 then raise exception 'ALERTA: la consulta alteró libros de operaciones ficticias'; end if;
end $test$;
select 'OK: conciliación solo lectura, 3 estados, dueño de cotización y permisos (PostgreSQL aislado)' as resultado;
