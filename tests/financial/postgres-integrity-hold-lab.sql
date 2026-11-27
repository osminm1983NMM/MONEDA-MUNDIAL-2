\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
-- Isolate from previous committed test fixtures.
UPDATE dispatch SET attempts=greatest(attempts,3) WHERE state<>'acknowledged';
CREATE TEMP TABLE hold_baseline AS SELECT coalesce(sum(held_orders),0) AS held FROM integrity_hold_summary;
INSERT INTO actor_policy VALUES ('holdGood','verified','clear','allow',50000),('holdBad','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('holdGood','beneficiary','verified'),('holdBad','beneficiary','verified');
DO $$ DECLARE q uuid; good uuid; bad uuid; lease record; ref text;
BEGIN
 SELECT quote_id INTO q FROM issue_quote('holdBad','beneficiary',10000);
 bad:=accept_quote('holdBad','request',q,'sandbox-disclosure-v1');
 SELECT quote_id INTO q FROM issue_quote('holdGood','beneficiary',10000);
 good:=accept_quote('holdGood','request',q,'sandbox-disclosure-v1');
 UPDATE reservations SET total_cents=total_cents+1 WHERE order_id=bad;
 IF order_integrity_ok(bad) OR NOT order_integrity_ok(good) OR order_integrity_ok(gen_random_uuid())
 THEN RAISE EXCEPTION 'integrity classification failed'; END IF;
 SELECT * INTO lease FROM claim_dispatch(30);
 IF NOT FOUND OR lease.order_id<>good THEN RAISE EXCEPTION 'healthy order not dispatched'; END IF;
 ref:=lease.reference;
 IF NOT check_dispatch_lease(ref,lease.token) THEN RAISE EXCEPTION 'healthy lease rejected'; END IF;
 IF EXISTS(SELECT FROM claim_dispatch(30)) THEN RAISE EXCEPTION 'corrupt queued order leased'; END IF;
 -- Corruption after claim must invalidate the final preflight, before transport.
 UPDATE reservations SET total_cents=total_cents+1 WHERE order_id=good;
 IF check_dispatch_lease(ref,lease.token) THEN RAISE EXCEPTION 'corrupt existing lease accepted'; END IF;
 IF (SELECT coalesce(sum(held_orders),0) FROM integrity_hold_summary)<>(SELECT held+2 FROM hold_baseline)
 THEN RAISE EXCEPTION 'integrity hold summary mismatch'; END IF;
 IF EXISTS(SELECT FROM journal WHERE order_id IN (good,bad)) THEN RAISE EXCEPTION 'hold changed journal'; END IF;
 -- Verified incoming events remain recordable: the gate is not a denial of financial evidence.
 IF record_verified_event('mock-remittance','hold-late-confirmation',ref,'confirmed','USD',10150)<>'funded'
 THEN RAISE EXCEPTION 'incoming confirmed event blocked'; END IF;
 IF (SELECT count(*) FROM journal WHERE order_id=good)<>1 OR order_integrity_ok(good)
 THEN RAISE EXCEPTION 'late event erased underlying corruption'; END IF;
END $$;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 PERFORM count(*) FROM integrity_hold_summary;
 BEGIN PERFORM order_integrity_ok(gen_random_uuid()); RAISE EXCEPTION 'private order lookup exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_dispatch_service;
DO $$ BEGIN
 BEGIN PERFORM count(*) FROM lifecycle_integrity_details; RAISE EXCEPTION 'private details exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
