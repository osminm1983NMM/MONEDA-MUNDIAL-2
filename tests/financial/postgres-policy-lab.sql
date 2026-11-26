\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
INSERT INTO actor_policy VALUES ('fixtureA','verified','clear','allow',20300),('fixtureB','pending','clear','allow',50000),('fixtureC','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('fixtureA','beneficiary','verified'),('fixtureB','beneficiary','verified'),('fixtureC','beneficiary','blocked');
SET LOCAL ROLE mwd_lab_order_service;
DO $$ BEGIN
 BEGIN PERFORM create_order('fixtureA','raw','raw','beneficiary',10000); RAISE EXCEPTION 'raw order allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM prepare_next(gen_random_uuid(),'payout'); RAISE EXCEPTION 'raw payout allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM issue_quote('fixtureB','beneficiary',10000); RAISE EXCEPTION 'identity bypass'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'COMPLIANCE_HOLD' THEN RAISE; END IF; END;
 BEGIN PERFORM issue_quote('fixtureC','beneficiary',10000); RAISE EXCEPTION 'beneficiary bypass'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'BENEFICIARY_HOLD' THEN RAISE; END IF; END;
 BEGIN UPDATE actor_policy SET daily_limit=999999; RAISE EXCEPTION 'policy mutation allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT quote_id FROM issue_quote('fixtureA','beneficiary',10000) \gset q1_
SELECT quote_id FROM issue_quote('fixtureA','beneficiary',10000) \gset q2_
SELECT quote_id FROM issue_quote('fixtureA','beneficiary',10000) \gset q3_
SELECT quote_id FROM issue_quote('fixtureA','beneficiary',10000) \gset expired_
RESET ROLE;
UPDATE quotes SET expires_at=clock_timestamp()-interval '1 second' WHERE id=:'expired_quote_id';
SET LOCAL ROLE mwd_lab_order_service;
SELECT set_config('mwd.test.q1',:'q1_quote_id',true),set_config('mwd.test.q2',:'q2_quote_id',true),set_config('mwd.test.q3',:'q3_quote_id',true),set_config('mwd.test.expired',:'expired_quote_id',true);
DO $$
DECLARE q1 uuid:=current_setting('mwd.test.q1')::uuid; q2 uuid:=current_setting('mwd.test.q2')::uuid; q3 uuid:=current_setting('mwd.test.q3')::uuid; o uuid;
BEGIN
 BEGIN PERFORM accept_quote('fixtureA','r0',q1,'wrong'); RAISE EXCEPTION 'consent bypass'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'CONSENT_REQUIRED' THEN RAISE; END IF; END;
 BEGIN PERFORM accept_quote('fixtureC','r0',q1,'sandbox-disclosure-v1'); RAISE EXCEPTION 'ownership bypass'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'QUOTE_UNAVAILABLE' THEN RAISE; END IF; END;
 BEGIN PERFORM accept_quote('fixtureA','expired',current_setting('mwd.test.expired')::uuid,'sandbox-disclosure-v1'); RAISE EXCEPTION 'expired bypass'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'QUOTE_UNAVAILABLE' THEN RAISE; END IF; END;
 o:=accept_quote('fixtureA','r1',q1,'sandbox-disclosure-v1');
 IF accept_quote('fixtureA','r1',q1,'sandbox-disclosure-v1')<>o THEN RAISE EXCEPTION 'retry changed order'; END IF;
 BEGIN PERFORM accept_quote('fixtureA','r1',q2,'sandbox-disclosure-v1'); RAISE EXCEPTION 'request mismatch bypass'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'IDEMPOTENCY_CONFLICT' THEN RAISE; END IF; END;
 BEGIN PERFORM accept_quote('fixtureA','new',q1,'sandbox-disclosure-v1'); RAISE EXCEPTION 'quote reuse'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'QUOTE_UNAVAILABLE' THEN RAISE; END IF; END;
 PERFORM accept_quote('fixtureA','r2',q2,'sandbox-disclosure-v1');
 BEGIN PERFORM accept_quote('fixtureA','r3',q3,'sandbox-disclosure-v1'); RAISE EXCEPTION 'limit bypass'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'DAILY_LIMIT' THEN RAISE; END IF; END;
 BEGIN PERFORM prepare_authorized('fixtureC',o,'payout'); RAISE EXCEPTION 'order ownership bypass'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ORDER_UNAVAILABLE' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT id FROM orders WHERE actor='fixtureA' AND request_id='r1' \gset first_
SELECT apply_verified_event('mock-remittance','policy-funding',:'first_id'||'-funding','confirmed','USD',10150);
UPDATE actor_policy SET sanctions='review' WHERE actor='fixtureA';
SET LOCAL ROLE mwd_lab_order_service;
SELECT set_config('mwd.test.order',:'first_id',true);
DO $$ BEGIN
 BEGIN PERFORM prepare_authorized('fixtureA',current_setting('mwd.test.order')::uuid,'payout'); RAISE EXCEPTION 'sanctions bypass'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'COMPLIANCE_HOLD' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE actor_policy SET sanctions='clear' WHERE actor='fixtureA';
SET LOCAL ROLE mwd_lab_order_service;
SELECT prepare_authorized('fixtureA',:'first_id','payout');
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM reservations WHERE actor='fixtureA')<>2 OR (SELECT sum(total_cents) FROM reservations WHERE actor='fixtureA')<>20300 THEN RAISE EXCEPTION 'reservation totals'; END IF;
 IF (SELECT count(*) FROM orders WHERE actor='fixtureA')<>2 THEN RAISE EXCEPTION 'order totals'; END IF;
 IF (SELECT count(*) FROM outbox x JOIN orders o ON o.id=x.order_id WHERE o.actor='fixtureA')<>3 THEN RAISE EXCEPTION 'outbox totals'; END IF;
 RAISE NOTICE 'quote, consent, ownership, policy, limit and payout checks passed';
END $$;
-- Blocked actor cannot dispatch even an already prepared payout or funding.
UPDATE actor_policy SET risk='review' WHERE actor='fixtureA';
SET LOCAL ROLE mwd_lab_dispatch_service;
DO $ BEGIN
 IF EXISTS(SELECT FROM claim_dispatch(30)) THEN RAISE EXCEPTION 'risk hold dispatch bypass'; END IF;
END $;
RESET ROLE;
UPDATE actor_policy SET risk='allow' WHERE actor='fixtureA';
SET LOCAL ROLE mwd_lab_dispatch_service;
DO $ BEGIN
 IF NOT EXISTS(SELECT FROM claim_dispatch(30)) THEN RAISE EXCEPTION 'eligible dispatch missing'; END IF;
END $;
RESET ROLE;
ROLLBACK;
