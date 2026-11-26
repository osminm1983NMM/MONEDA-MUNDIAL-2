-- DEMO only: all configured financial routes must remain simulation-only.
BEGIN TRANSACTION READ ONLY;
DO $gate$
DECLARE routes integer;
BEGIN
 SELECT count(*) INTO routes FROM mwd_finance_private.demo_fee_routes;
 IF routes=0 THEN RAISE EXCEPTION 'No DEMO routes configured'; END IF;
 IF EXISTS(SELECT 1 FROM mwd_finance_private.demo_fee_routes WHERE real_payments_enabled IS DISTINCT FROM false) THEN RAISE EXCEPTION 'Real payment flag enabled or unknown'; END IF;
 IF NOT EXISTS(SELECT 1 FROM mwd_finance_private.demo_fee_routes WHERE origin_country='US' AND destination_country='HN' AND simulator_enabled IS TRUE) THEN RAISE EXCEPTION 'US-HN DEMO route unavailable'; END IF;
END $gate$;
ROLLBACK;
