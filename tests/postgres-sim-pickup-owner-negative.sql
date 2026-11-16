-- Negative authorization test for the real SIM pickup function snapshot.
-- Must run only in ephemeral PostgreSQL after postgres-sim-pickup-real-function.sql.
DO $$
DECLARE r jsonb; n int;
BEGIN
 INSERT INTO mwd_pickup_private.demo_orders(id,pickup_code_sha256,expires_at)
 VALUES ('00000000-0000-0000-0000-000000000805',
 encode(extensions.digest('SIM-0123456789ABCDEF0123456789ABCDEF','sha256'),'hex'),
 clock_timestamp()+interval '1 hour');
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000902',true);
 BEGIN
  r:=public.mwd_owner_pickup_simulate_demo('00000000-0000-0000-0000-000000000805','SIM-0123456789ABCDEF0123456789ABCDEF');
  RAISE EXCEPTION 'non-owner unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN
  r:=public.mwd_owner_pickup_simulate_demo('00000000-0000-0000-0000-000000000805','SIM-0123456789ABCDEF0123456789ABCDEF');
  RAISE EXCEPTION 'anonymous unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 SELECT count(*) INTO n FROM mwd_pickup_private.demo_order_events WHERE order_id='00000000-0000-0000-0000-000000000805';
 IF n<>0 OR (SELECT status FROM mwd_pickup_private.demo_orders WHERE id='00000000-0000-0000-0000-000000000805')<>'pending'
 THEN RAISE EXCEPTION 'unauthorized request mutated order'; END IF;
END $$;
SELECT 'SIM_PICKUP_OWNER_NEGATIVE_PASS' AS result;
