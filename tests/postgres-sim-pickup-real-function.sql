-- Replica aislada de la función pública mwd_owner_pickup_simulate_demo leída de pg_get_functiondef.
-- PostgreSQL efímero: NUNCA ejecutar este archivo en Supabase principal.
CREATE SCHEMA IF NOT EXISTS mwd_pickup_private;
CREATE SCHEMA IF NOT EXISTS mwd_partners_private;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE TABLE mwd_pickup_private.demo_orders (
 id uuid PRIMARY KEY, pickup_code_sha256 text NOT NULL, status text NOT NULL DEFAULT 'pending',
 expires_at timestamptz NOT NULL, processed_at timestamptz, processed_by uuid
);
CREATE TABLE mwd_pickup_private.demo_claim_attempts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, order_id uuid NOT NULL,actor_id uuid NOT NULL,
 outcome text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE mwd_pickup_private.demo_order_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,order_id uuid NOT NULL,
 event_kind text NOT NULL,actor_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION mwd_partners_private.assert_owner() RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE actor uuid;
BEGIN
 actor := nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 IF actor IS DISTINCT FROM '00000000-0000-0000-0000-000000000901'::uuid THEN
  RAISE EXCEPTION 'owner required' USING ERRCODE='42501';
 END IF;
 RETURN actor;
END $$;
CREATE OR REPLACE FUNCTION public.mwd_owner_pickup_simulate_demo(p_order_id uuid, p_pickup_code text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
 v_actor uuid;
 v_order mwd_pickup_private.demo_orders%rowtype;
 v_clean text := upper(btrim(coalesce(p_pickup_code,'')));
 v_failures integer;
begin
 v_actor := mwd_partners_private.assert_owner();
 if p_order_id is null then raise exception 'Solicitud de prueba inválida' using errcode='22023'; end if;
 select * into v_order from mwd_pickup_private.demo_orders where id=p_order_id for update;
 if not found then raise exception 'Solicitud de prueba no disponible' using errcode='22023'; end if;
 if v_order.status <> 'pending' or v_order.expires_at <= clock_timestamp() then
  return jsonb_build_object('status','not_available','orderId',v_order.id,'cashDisbursed',false,'realPaymentsEnabled',false);
 end if;
 select count(*) into v_failures from mwd_pickup_private.demo_claim_attempts a
 where a.order_id=v_order.id and a.outcome='invalid'
 and a.created_at > clock_timestamp()-interval '15 minutes';
 if v_failures >= 5 then
  return jsonb_build_object('status','temporarily_blocked','orderId',v_order.id,
   'message','Demasiados códigos incorrectos. Intenta más tarde.','cashDisbursed',false,'realPaymentsEnabled',false);
 end if;
 if length(v_clean)>80 or v_clean !~ '^SIM-[A-F0-9]{32}$'
 or v_order.pickup_code_sha256 <> encode(extensions.digest(v_clean,'sha256'),'hex') then
  insert into mwd_pickup_private.demo_claim_attempts(order_id,actor_id,outcome)
  values(v_order.id,v_actor,'invalid');
  return jsonb_build_object('status','invalid_code','orderId',v_order.id,
   'remainingAttempts',greatest(0,4-v_failures),'cashDisbursed',false,'realPaymentsEnabled',false);
 end if;
 update mwd_pickup_private.demo_orders set status='simulated_collected',
 processed_at=clock_timestamp(),processed_by=v_actor where id=v_order.id and status='pending';
 insert into mwd_pickup_private.demo_order_events(order_id,event_kind,actor_id)
 values(v_order.id,'simulated_collected',v_actor);
 insert into mwd_pickup_private.demo_claim_attempts(order_id,actor_id,outcome)
 values(v_order.id,v_actor,'successful');
 return jsonb_build_object('status','simulated_collected','orderId',v_order.id,
 'cashDisbursed',false,'realPaymentsEnabled',false);
end; $function$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
INSERT INTO mwd_pickup_private.demo_orders(id,pickup_code_sha256,expires_at)
SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
 encode(extensions.digest('SIM-0123456789ABCDEF0123456789ABCDEF','sha256'),'hex'),
 clock_timestamp()+interval '1 hour' FROM generate_series(801,803) i;
UPDATE mwd_pickup_private.demo_orders SET expires_at=clock_timestamp()-interval '1 minute'
 WHERE id='00000000-0000-0000-0000-000000000803';
DO $$
DECLARE r jsonb; i int;
BEGIN
 r:=public.mwd_owner_pickup_simulate_demo('00000000-0000-0000-0000-000000000801','bad');
 IF r->>'status'<>'invalid_code' THEN RAISE EXCEPTION 'wrong code accepted'; END IF;
 FOR i IN 2..5 LOOP
  PERFORM public.mwd_owner_pickup_simulate_demo('00000000-0000-0000-0000-000000000801','bad');
 END LOOP;
 r:=public.mwd_owner_pickup_simulate_demo('00000000-0000-0000-0000-000000000801','SIM-0123456789ABCDEF0123456789ABCDEF');
 IF r->>'status'<>'temporarily_blocked' THEN RAISE EXCEPTION 'lockout bypass'; END IF;
 r:=public.mwd_owner_pickup_simulate_demo('00000000-0000-0000-0000-000000000803','SIM-0123456789ABCDEF0123456789ABCDEF');
 IF r->>'status'<>'not_available' THEN RAISE EXCEPTION 'expired accepted'; END IF;
 r:=public.mwd_owner_pickup_simulate_demo('00000000-0000-0000-0000-000000000802','SIM-0123456789ABCDEF0123456789ABCDEF');
 IF r->>'status'<>'simulated_collected' OR r->>'cashDisbursed'<>'false' THEN RAISE EXCEPTION 'valid pickup failed'; END IF;
 r:=public.mwd_owner_pickup_simulate_demo('00000000-0000-0000-0000-000000000802','SIM-0123456789ABCDEF0123456789ABCDEF');
 IF r->>'status'<>'not_available' THEN RAISE EXCEPTION 'double pickup'; END IF;
 IF (SELECT count(*) FROM mwd_pickup_private.demo_order_events WHERE order_id='00000000-0000-0000-0000-000000000802')<>1 THEN RAISE EXCEPTION 'duplicate event'; END IF;
END $$;
SELECT 'SIM_REAL_FUNCTION_SNAPSHOT_PASS' AS result;
