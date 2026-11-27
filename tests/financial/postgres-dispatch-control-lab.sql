\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
UPDATE dispatch SET attempts=greatest(attempts,3) WHERE state<>'acknowledged';
INSERT INTO actor_policy VALUES ('haltFixture','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('haltFixture','beneficiary','verified');
SELECT quote_id FROM issue_quote('haltFixture','beneficiary',10000) \gset
SELECT accept_quote('haltFixture','halt-1',:'quote_id','sandbox-disclosure-v1') AS test_order \gset
SELECT set_config('mwd.halt_order',:'test_order',true);
DO $$ DECLARE l record;
BEGIN
 SELECT * INTO l FROM claim_dispatch(30);
 IF NOT FOUND OR l.order_id<>current_setting('mwd.halt_order')::uuid THEN RAISE EXCEPTION 'healthy dispatch missing'; END IF;
 IF NOT check_dispatch_lease(l.reference,l.token) THEN RAISE EXCEPTION 'healthy lease rejected'; END IF;
 PERFORM set_config('mwd.halt_ref',l.reference,true);
 PERFORM set_config('mwd.halt_token',l.token::text,true);
END $$;
SET LOCAL ROLE mwd_lab_dispatch_service;
DO $$ BEGIN
 BEGIN PERFORM halt_dispatch('operator_emergency'); RAISE EXCEPTION 'unauthorized halt';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_safety_service;
DO $$ BEGIN
 IF halt_dispatch('provider_outage')<>'halted' THEN RAISE EXCEPTION 'halt failed'; END IF;
 IF halt_dispatch('provider_outage')<>'already_halted' THEN RAISE EXCEPTION 'halt not idempotent'; END IF;
 BEGIN UPDATE dispatch_control SET halted=false; RAISE EXCEPTION 'unauthorized resume';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM count(*) FROM orders; RAISE EXCEPTION 'private order access';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF check_dispatch_lease(current_setting('mwd.halt_ref'),current_setting('mwd.halt_token')::uuid) THEN RAISE EXCEPTION 'halt did not invalidate preflight'; END IF;
END $$;
SELECT quote_id FROM issue_quote('haltFixture','beneficiary',10000) \gset
SELECT accept_quote('haltFixture','halt-2',:'quote_id','sandbox-disclosure-v1');
DO $$ BEGIN
 IF EXISTS(SELECT FROM claim_dispatch(30)) THEN RAISE EXCEPTION 'new dispatch while halted'; END IF;
 IF record_verified_event('mock-remittance','halt-late-confirmation',current_setting('mwd.halt_ref'),'confirmed','USD',10150)<>'funded'
 THEN RAISE EXCEPTION 'halt discarded incoming confirmation'; END IF;
 IF (SELECT count(*) FROM journal WHERE order_id=current_setting('mwd.halt_order')::uuid)<>1
 THEN RAISE EXCEPTION 'late confirmation posting mismatch'; END IF;
END $$;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 IF NOT (SELECT halted AND halt_count=1 FROM dispatch_control_summary) THEN RAISE EXCEPTION 'incorrect audit summary'; END IF;
 BEGIN PERFORM count(*) FROM dispatch_halt_events; RAISE EXCEPTION 'raw halt log exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Missing control row must also prevent new dispatch.
DELETE FROM dispatch_control;
DO $$ BEGIN
 IF EXISTS(SELECT FROM claim_dispatch(30)) OR NOT (SELECT halted FROM dispatch_control_summary)
 THEN RAISE EXCEPTION 'missing control not fail closed'; END IF;
END $$;
ROLLBACK;
