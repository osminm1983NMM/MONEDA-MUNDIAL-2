-- Verify that a SIM demo pickup lockout is time-window based, not permanent.
-- Ephemeral PostgreSQL only; run after postgres-sim-pickup-real-function.sql.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000901',false);
DO $$
DECLARE r jsonb; n int;
BEGIN
 IF (SELECT count(*) FROM mwd_pickup_private.demo_claim_attempts
     WHERE order_id='00000000-0000-0000-0000-000000000801' AND outcome='invalid')<>5
 THEN RAISE EXCEPTION 'Expected five invalid attempts'; END IF;
 UPDATE mwd_pickup_private.demo_claim_attempts
 SET created_at=clock_timestamp()-interval '16 minutes'
 WHERE order_id='00000000-0000-0000-0000-000000000801';
 r:=public.mwd_owner_pickup_simulate_demo('00000000-0000-0000-0000-000000000801',
 '  sim-0123456789abcdef0123456789abcdef  ');
 IF r->>'status'<>'simulated_collected' THEN
  RAISE EXCEPTION 'Correct code after window should work: %',r;
 END IF;
 IF (SELECT count(*) FROM mwd_pickup_private.demo_order_events
 WHERE order_id='00000000-0000-0000-0000-000000000801'
 AND event_kind='simulated_collected')<>1
 THEN RAISE EXCEPTION 'Unexpected audit event count'; END IF;
END $$;
SELECT 'SIM_PICKUP_LOCKOUT_WINDOW_PASS' AS result;
