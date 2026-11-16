-- Verify correct code remains usable after exactly four failed attempts.
-- Run against isolated real-function snapshot; never Supabase production.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
INSERT INTO mwd_pickup_private.demo_orders(id,pickup_code_sha256,expires_at)
VALUES ('00000000-0000-0000-0000-000000000806',
 encode(extensions.digest('SIM-0123456789ABCDEF0123456789ABCDEF','sha256'),'hex'),
 clock_timestamp()+interval '1 hour');
DO $$
DECLARE i integer; r jsonb;
BEGIN
 FOR i IN 1..4 LOOP
  r:=public.mwd_owner_pickup_simulate_demo('00000000-0000-0000-0000-000000000806','invalid');
  IF r->>'status'<>'invalid_code' OR (r->>'remainingAttempts')::int<>5-i THEN
   RAISE EXCEPTION 'Unexpected remaining attempts after % failures: %',i,r;
  END IF;
 END LOOP;
 r:=public.mwd_owner_pickup_simulate_demo('00000000-0000-0000-0000-000000000806',
 'SIM-0123456789ABCDEF0123456789ABCDEF');
 IF r->>'status'<>'simulated_collected' THEN RAISE EXCEPTION 'Fourth attempt prematurely blocked: %',r; END IF;
 IF (SELECT count(*) FROM mwd_pickup_private.demo_claim_attempts
 WHERE order_id='00000000-0000-0000-0000-000000000806' AND outcome='successful')<>1
 THEN RAISE EXCEPTION 'Expected one successful claim'; END IF;
END $$;
SELECT 'SIM_PICKUP_FOUR_FAILURE_BOUNDARY_PASS' AS result;
