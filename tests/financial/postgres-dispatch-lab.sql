\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
SET LOCAL ROLE mwd_lab_order_service;
SELECT create_order('A','r1','q1','synthetic',10000) AS order_id \gset
DO $$ BEGIN
 BEGIN PERFORM count(*) FROM orders; RAISE EXCEPTION 'table read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM claim_dispatch(10); RAISE EXCEPTION 'dispatch allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM apply_verified_event('mock-remittance','x','x','confirmed','USD',1); RAISE EXCEPTION 'event allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_dispatch_service;
SELECT * FROM claim_dispatch(30) \gset first_
DO $$ BEGIN
 IF EXISTS(SELECT FROM claim_dispatch(30)) THEN RAISE EXCEPTION 'double lease'; END IF;
 BEGIN PERFORM create_order('B','r2','q2','synthetic',10000); RAISE EXCEPTION 'order allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM acknowledge_dispatch('wrong',gen_random_uuid()); RAISE EXCEPTION 'ack allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'STALE_LEASE' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
-- Advance fixture expiry without a wall-clock sleep.
UPDATE dispatch SET lease_until=clock_timestamp()-interval '1 second' WHERE reference=:'first_reference';
SET LOCAL ROLE mwd_lab_dispatch_service;
SELECT * FROM claim_dispatch(30) \gset second_
SELECT (:'first_reference'=:'second_reference' AND :'first_token'<>:'second_token' AND :'second_attempts'::bigint=2) AS recovered \gset
\if :recovered
\else
\quit 1
\endif
-- Old token rejection, even after another worker takes over.
SELECT set_config('mwd.test.reference',:'first_reference',true),set_config('mwd.test.token',:'first_token',true);
DO $$ BEGIN
 BEGIN PERFORM acknowledge_dispatch(current_setting('mwd.test.reference'),current_setting('mwd.test.token')::uuid); RAISE EXCEPTION 'old token allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'STALE_LEASE' THEN RAISE; END IF; END;
END $$;
SELECT acknowledge_dispatch(:'second_reference',:'second_token'::uuid);
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT FROM orders WHERE state<>'funding_pending') OR EXISTS(SELECT FROM journal) THEN RAISE EXCEPTION 'transport ack incorrectly settled funds'; END IF; END $$;
SET LOCAL ROLE mwd_lab_event_service;
SELECT apply_verified_event('mock-remittance','event1',:'second_reference','confirmed','USD',10150);
DO $$ BEGIN
 BEGIN PERFORM prepare_next(gen_random_uuid(),'payout'); RAISE EXCEPTION 'order mutation allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM journal; RAISE EXCEPTION 'journal deletion allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 IF (SELECT payable FROM journal_summary)<>-10150 THEN RAISE EXCEPTION 'audit mismatch'; END IF;
 BEGIN PERFORM count(*) FROM inbox; RAISE EXCEPTION 'raw event read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM claim_dispatch(30); RAISE EXCEPTION 'dispatch allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_roles WHERE rolname LIKE 'mwd_lab_%_service' AND rolcanlogin) THEN RAISE EXCEPTION 'lab login enabled'; END IF;
 RAISE NOTICE 'dispatch recovery and role boundaries passed';
END $$;
ROLLBACK;
