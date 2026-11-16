-- Snapshot of production mwd_owner_remittance_transition_demo, executed ONLY in ephemeral CI PostgreSQL.
CREATE SCHEMA IF NOT EXISTS mwd_remittance_demo_private;
CREATE TABLE mwd_remittance_demo_private.orders(
 id uuid PRIMARY KEY, created_by uuid NOT NULL, request_id uuid NOT NULL UNIQUE,
 source_country text NOT NULL DEFAULT 'US',destination_country text NOT NULL,
 amount_cents bigint NOT NULL,status text NOT NULL DEFAULT 'draft',
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE mwd_remittance_demo_private.events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,order_id uuid NOT NULL,
 actor_id uuid NOT NULL,request_id uuid NOT NULL,event_type text NOT NULL,
 from_status text,to_status text NOT NULL,occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(order_id,request_id));
CREATE OR REPLACE FUNCTION mwd_remittance_demo_private.assert_owner() RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE actor uuid;
BEGIN
 actor:=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
 IF actor IS DISTINCT FROM '00000000-0000-0000-0000-000000000901'::uuid
 THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
 RETURN actor;
END $$;
CREATE OR REPLACE FUNCTION public.mwd_owner_remittance_transition_demo(p_order_id uuid, p_new_status text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid;
 v_order mwd_remittance_demo_private.orders%rowtype;
 v_previous mwd_remittance_demo_private.events%rowtype;
 v_event_type text;
begin
 v_actor := mwd_remittance_demo_private.assert_owner();
 if p_order_id is null or p_request_id is null or
    p_new_status is null or p_new_status not in ('review','simulated','cancelled')
 then raise exception 'Transición ficticia no válida' using errcode='22023'; end if;
 select * into v_order from mwd_remittance_demo_private.orders
   where id=p_order_id for update;
 if not found then raise exception 'Remesa ficticia inexistente' using errcode='22023'; end if;
 select * into v_previous from mwd_remittance_demo_private.events
   where order_id=p_order_id and request_id=p_request_id;
 if found then
   if v_previous.to_status <> p_new_status then
     raise exception 'Clave de reintento utilizada con otro estado'
       using errcode='22023';
   end if;
   return jsonb_build_object('id',p_order_id,'status',v_order.status,
     'already_processed',true,'real_payments_enabled',false,'redeemable',false);
 end if;
 if not (
   (v_order.status='draft' and p_new_status in ('review','cancelled')) or
   (v_order.status='review' and p_new_status in ('simulated','cancelled'))
 ) then
   raise exception 'El cambio de estado no está permitido' using errcode='22023';
 end if;
 v_event_type := case p_new_status
   when 'review' then 'submitted_for_review'
   when 'simulated' then 'simulation_completed'
   else 'cancelled' end;
 update mwd_remittance_demo_private.orders
    set status=p_new_status, updated_at=now()
   where id=p_order_id;
 insert into mwd_remittance_demo_private.events
   (order_id,actor_id,request_id,event_type,from_status,to_status)
 values (p_order_id,v_actor,p_request_id,v_event_type,v_order.status,p_new_status);
 return jsonb_build_object('id',p_order_id,'status',p_new_status,
    'already_processed',false,'real_payments_enabled',false,'redeemable',false);
end; $function$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
INSERT INTO mwd_remittance_demo_private.orders(id,created_by,request_id,destination_country,amount_cents)
VALUES ('00000000-0000-0000-0000-000000000811','00000000-0000-0000-0000-000000000901','00000000-0000-0000-0000-000000000821','HN',10000);
DO $$
DECLARE r jsonb; oid uuid:='00000000-0000-0000-0000-000000000811';
BEGIN
 r:=public.mwd_owner_remittance_transition_demo(oid,'review','00000000-0000-0000-0000-000000000831');
 IF r->>'status'<>'review' OR r->>'already_processed'<>'false' THEN RAISE EXCEPTION 'draft->review failed'; END IF;
 r:=public.mwd_owner_remittance_transition_demo(oid,'review','00000000-0000-0000-0000-000000000831');
 IF r->>'already_processed'<>'true' THEN RAISE EXCEPTION 'idempotent replay failed'; END IF;
 BEGIN
  PERFORM public.mwd_owner_remittance_transition_demo(oid,'cancelled','00000000-0000-0000-0000-000000000831');
  RAISE EXCEPTION 'conflicting replay accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 r:=public.mwd_owner_remittance_transition_demo(oid,'simulated','00000000-0000-0000-0000-000000000832');
 IF r->>'status'<>'simulated' OR r->>'redeemable'<>'false' THEN RAISE EXCEPTION 'review->simulated failed'; END IF;
 BEGIN
  PERFORM public.mwd_owner_remittance_transition_demo(oid,'cancelled','00000000-0000-0000-0000-000000000833');
  RAISE EXCEPTION 'terminal state changed';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 IF (SELECT count(*) FROM mwd_remittance_demo_private.events WHERE order_id=oid)<>2 THEN RAISE EXCEPTION 'duplicate or missing events'; END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',true);
 BEGIN
  PERFORM public.mwd_owner_remittance_transition_demo(oid,'review','00000000-0000-0000-0000-000000000834');
  RAISE EXCEPTION 'non-owner allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF (SELECT status FROM mwd_remittance_demo_private.orders WHERE id=oid)<>'simulated' THEN RAISE EXCEPTION 'unexpected mutation'; END IF;
END $$;
SELECT 'REAL_REMITTANCE_TRANSITION_SNAPSHOT_PASS' AS result;

-- Additional branch: draft cancellation is terminal and creates one event.
INSERT INTO mwd_remittance_demo_private.orders(id,created_by,request_id,destination_country,amount_cents)
VALUES ('00000000-0000-0000-0000-000000000812','00000000-0000-0000-0000-000000000901','00000000-0000-0000-0000-000000000822','HN',2500);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
DO $$
DECLARE r jsonb; oid uuid:='00000000-0000-0000-0000-000000000812';
BEGIN
 r:=public.mwd_owner_remittance_transition_demo(oid,'cancelled','00000000-0000-0000-0000-000000000835');
 IF r->>'status'<>'cancelled' OR r->>'real_payments_enabled'<>'false' THEN RAISE EXCEPTION 'draft cancellation failed'; END IF;
 r:=public.mwd_owner_remittance_transition_demo(oid,'cancelled','00000000-0000-0000-0000-000000000835');
 IF r->>'already_processed'<>'true' THEN RAISE EXCEPTION 'cancel replay failed'; END IF;
 BEGIN
  PERFORM public.mwd_owner_remittance_transition_demo(oid,'review','00000000-0000-0000-0000-000000000836');
  RAISE EXCEPTION 'cancelled order reopened';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 IF (SELECT count(*) FROM mwd_remittance_demo_private.events WHERE order_id=oid)<>1
 THEN RAISE EXCEPTION 'cancellation duplicated event'; END IF;
 BEGIN
  PERFORM public.mwd_owner_remittance_transition_demo(oid,'unrecognized','00000000-0000-0000-0000-000000000837');
  RAISE EXCEPTION 'invalid status accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
END $$;
SELECT 'REAL_REMITTANCE_CANCELLATION_PASS' AS result;
