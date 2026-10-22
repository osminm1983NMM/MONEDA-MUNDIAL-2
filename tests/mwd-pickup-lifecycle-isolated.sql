\set ON_ERROR_STOP on
-- Ensayo de RETIRO SOLO DEMO en PostgreSQL desechable del CI.
-- No ejecuta SQL contra el Supabase compartido ni dinero/órdenes reales.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
create schema mwd_partners_private;
create function mwd_partners_private.assert_owner() returns uuid
language plpgsql security definer set search_path='' as $f$
declare v_user uuid:=auth.uid();
begin
 if v_user is distinct from '99999999-9999-4999-8999-999999999999'::uuid
 then raise exception 'No autorizado' using errcode='42501'; end if;
 return v_user;
end; $f$;
insert into auth.users values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('99999999-9999-4999-8999-999999999999');
\ir ../database/mwd_pickup_without_phone_demo.sql
\ir ../database/mwd_pickup_antifraud_demo.sql

set role authenticated;
do $cases$
declare
 a uuid:='11111111-1111-4111-8111-111111111111';
 b uuid:='22222222-2222-4222-8222-222222222222';
 owner_id uuid:='99999999-9999-4999-8999-999999999999';
 shared_id uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 other_id uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 first_order jsonb;
 again jsonb;
 second_user jsonb;
 other_order jsonb;
 result jsonb;
 code text;
begin
 -- 1. Creación de una sola orden por usuario/referencia. Sin fondos.
 perform set_config('request.jwt.claim.sub',a::text,true);
 first_order:=public.mwd_pickup_create_demo('HN',2500,shared_id);
 if first_order->>'status'<>'created' or first_order->>'isFunded'<>'false'
    or first_order->>'canPayOut'<>'false' or first_order->>'realPaymentsEnabled'<>'false'
    or first_order->>'pickupCode' !~ '^SIM-[A-F0-9]{32}$'
 then raise exception 'La creación no respeta límites de SOLO DEMO'; end if;
 code:=first_order->>'pickupCode';
 again:=public.mwd_pickup_create_demo('HN',2500,shared_id);
 if again->>'status'<>'already_created'
    or again->>'pickupCode' is not null
    or again->>'orderId' is distinct from first_order->>'orderId'
 then raise exception 'Reintento filtró el código o duplicó la orden'; end if;
 begin
  perform public.mwd_pickup_create_demo('NI',2500,shared_id);
  raise exception 'Se aceptó la referencia con otro país';
 exception when sqlstate '22023' then null;
 end;
 if jsonb_array_length(public.mwd_pickup_my_orders_demo())<>1
 then raise exception 'La cuenta A no ve exactamente su orden'; end if;
 -- 2. Aislada por dueño: una cuenta diferente con mismo UUID no ve A.
 perform set_config('request.jwt.claim.sub',b::text,true);
 if jsonb_array_length(public.mwd_pickup_my_orders_demo())<>0
 then raise exception 'B pudo leer órdenes de A'; end if;
 second_user:=public.mwd_pickup_create_demo('NI',3200,shared_id);
 if second_user->>'status'<>'created'
    or second_user->>'orderId'=first_order->>'orderId'
 then raise exception 'No hay aislamiento por usuario'; end if;
 begin
  perform public.mwd_pickup_cancel_demo((first_order->>'orderId')::uuid);
  raise exception 'B pudo cancelar orden de A';
 exception when sqlstate '22023' then null;
 end;
 -- 3. Actor no autorizado NO puede simular entrega.
 begin
  perform public.mwd_owner_pickup_simulate_demo((first_order->>'orderId')::uuid,code);
  raise exception 'B pudo simular entrega sin ser dueño';
 exception when insufficient_privilege then null;
 end;
 -- 4. Cinco códigos incorrectos generan bloqueo, incluso ante código correcto.
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 for i in 1..5 loop
  result:=public.mwd_owner_pickup_simulate_demo((first_order->>'orderId')::uuid,
   'SIM-00000000000000000000000000000000');
  if result->>'status'<>'invalid_code' or result->>'cashDisbursed'<>'false'
  then raise exception 'Intento erróneo % no controlado',i; end if;
 end loop;
 result:=public.mwd_owner_pickup_simulate_demo((first_order->>'orderId')::uuid,code);
 if result->>'status'<>'temporarily_blocked'
 then raise exception 'No bloqueó tras cinco intentos incorrectos'; end if;
 -- 5. Orden nueva: un solo canje, nunca dos, y no pagó efectivo.
 perform set_config('request.jwt.claim.sub',a::text,true);
 other_order:=public.mwd_pickup_create_demo('HN',1000,other_id);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 result:=public.mwd_owner_pickup_simulate_demo((other_order->>'orderId')::uuid,
  other_order->>'pickupCode');
 if result->>'status'<>'simulated_collected'
    or result->>'cashDisbursed'<>'false' or result->>'realPaymentsEnabled'<>'false'
 then raise exception 'Canje ficticio inválido'; end if;
 result:=public.mwd_owner_pickup_simulate_demo((other_order->>'orderId')::uuid,
  other_order->>'pickupCode');
 if result->>'status'<>'not_available' or result->>'cashDisbursed'<>'false'
 then raise exception 'Canje duplicado no fue bloqueado'; end if;
 -- 6. Remitente puede cancelar orden pendiente y no puede canjearla.
 perform set_config('request.jwt.claim.sub',a::text,true);
 result:=public.mwd_pickup_cancel_demo((first_order->>'orderId')::uuid);
 if result->>'status'<>'cancelled' then raise exception 'No se pudo cancelar'; end if;
 result:=public.mwd_pickup_cancel_demo((first_order->>'orderId')::uuid);
 if result->>'status'<>'already_cancelled' then raise exception 'Cancelación no idempotente'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 result:=public.mwd_owner_pickup_simulate_demo((first_order->>'orderId')::uuid,code);
 if result->>'status'<>'not_available' then raise exception 'Orden cancelada fue canjeable'; end if;
 -- 7. Rechazo de lectura directa en tablas privadas.
 begin
  perform count(*) from mwd_pickup_private.demo_orders;
  raise exception 'Se admitió acceso directo a tablas de retiro';
 exception when insufficient_privilege then null;
 end;
end $cases$;
reset role;
do $assertions$
declare n integer;
begin
 if (select count(*) from mwd_pickup_private.demo_orders)<>3
    then raise exception 'Número de órdenes inesperado'; end if;
 if (select count(*) from mwd_pickup_private.demo_order_events where event_kind='created')<>3
    or (select count(*) from mwd_pickup_private.demo_order_events where event_kind='simulated_collected')<>1
    or (select count(*) from mwd_pickup_private.demo_order_events where event_kind='cancelled')<>1
 then raise exception 'Eventos de creación, cancelación o canje duplicados'; end if;
 if (select count(*) from mwd_pickup_private.demo_claim_attempts where outcome='invalid')<>5
    or (select count(*) from mwd_pickup_private.demo_claim_attempts where outcome='successful')<>1
 then raise exception 'Auditoría de códigos inesperada'; end if;
 if (select count(*) from mwd_pickup_private.demo_orders where status='simulated_collected')<>1
    or (select count(*) from mwd_pickup_private.demo_orders where status='cancelled')<>1
 then raise exception 'Estados finales incorrectos'; end if;
 if (select count(*) from mwd_pickup_private.demo_order_events
     group by order_id,event_kind having count(*)>1 limit 1)>0 then
   raise exception 'Se duplicó un evento';
 end if;
end $assertions$;
select 'PASS: retiro DEMO aislado, códigos 1 sola vista, bloqueo tras cinco fallos, sin doble canje ni efectivo' as resultado;
