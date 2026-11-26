-- FOR A DISPOSABLE LOCAL DATABASE ONLY. Never execute against the shared project.
-- Requires the full migrated DEMO schema. Creates two synthetic users, no login credentials.
BEGIN;
DO $fixture$
DECLARE a constant uuid:='f1a00000-0000-4000-8000-000000000001'; b constant uuid:='f1a00000-0000-4000-8000-000000000002';
BEGIN
 IF current_database()<>'mwd_demo_isolated' OR
  (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM 'MWD_DISPOSABLE_CONCURRENCY_TEST_ONLY'
 THEN RAISE EXCEPTION 'Refusing non-disposable database'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM public.mwd_wallets) OR
    EXISTS(SELECT 1 FROM public.mwd_profiles) OR EXISTS(SELECT 1 FROM public.mwd_operations) OR
    EXISTS(SELECT 1 FROM mwd_swap_private.demo_balances) OR EXISTS(SELECT 1 FROM mwd_swap_private.demo_quotes) OR
    EXISTS(SELECT 1 FROM mwd_swap_private.demo_conversions) OR EXISTS(SELECT 1 FROM mwd_pickup_private.demo_orders)
 THEN RAISE EXCEPTION 'Fixtures require an empty migrated database; discard and recreate'; END IF;
 IF EXISTS(SELECT 1 FROM mwd_finance_private.demo_fee_routes WHERE real_payments_enabled IS DISTINCT FROM false)
 OR NOT EXISTS(SELECT 1 FROM mwd_finance_private.demo_fee_routes WHERE origin_country='US' AND destination_country='HN' AND simulator_enabled IS TRUE)
 THEN RAISE EXCEPTION 'Unsafe or unavailable DEMO routes'; END IF;
 IF (SELECT count(*) FROM mwd_swap_private.demo_pool WHERE asset_code IN ('COIN','STABLE') AND balance_micro>=10000000)<>2
 OR NOT EXISTS(SELECT 1 FROM mwd_swap_private.demo_rates WHERE id='sandbox_v1' AND active IS TRUE AND stable_per_coin>0 AND fee_bps>=0 AND fee_bps<10000)
 THEN RAISE EXCEPTION 'Missing migrated simulator liquidity or rate'; END IF;
 -- No real email, encrypted password, identity provider or Auth API request.
 INSERT INTO auth.users(id,aud,role,email,created_at,updated_at)
 VALUES (a,'authenticated','authenticated','fixture-a@example.invalid',now(),now()),
        (b,'authenticated','authenticated','fixture-b@example.invalid',now(),now());
 IF (SELECT count(*) FROM public.mwd_wallets WHERE user_id IN (a,b) AND balance_cents=1000000)<>2
 OR (SELECT count(*) FROM public.mwd_profiles WHERE user_id IN (a,b))<>2
 THEN RAISE EXCEPTION 'Signup trigger did not initialize both wallets'; END IF;
 PERFORM mwd_swap_private.ensure_demo_balances(a);
 PERFORM mwd_swap_private.ensure_demo_balances(b);
 IF (SELECT count(*) FROM mwd_swap_private.demo_balances WHERE user_id IN (a,b) AND ((asset_code='COIN' AND balance_micro=100000000) OR (asset_code='STABLE' AND balance_micro=1000000000)))<>4
 THEN RAISE EXCEPTION 'Missing synthetic conversion balances'; END IF;
END $fixture$;
COMMIT;
