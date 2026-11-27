\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=pg_catalog,mwd_financial_lab,pg_temp;
INSERT INTO actor_policy VALUES
 ('status-fixture-owner','verified','clear','allow',50000),
 ('status-fixture-other','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('status-fixture-owner','beneficiary','verified');
SET LOCAL ROLE mwd_lab_order_service;
DO $$
DECLARE q uuid; o uuid; a record;
BEGIN
 SELECT quote_id INTO STRICT q FROM issue_quote('status-fixture-owner','beneficiary',10000);
 o:=accept_quote('status-fixture-owner','status-request',q,'sandbox-disclosure-v1');
 SELECT * INTO STRICT a FROM read_order_status('status-fixture-owner',o);
 IF (a.order_id,a.status,a.principal_minor,a.fee_minor,a.total_minor,a.source_currency,a.payout_minor,a.payout_currency)
 IS DISTINCT FROM (o,'funding_pending'::text,10000::bigint,150::bigint,10150::bigint,'USD'::text,250000::bigint,'HNL'::text)
 OR a.accepted_at IS NULL THEN RAISE EXCEPTION 'incorrect status projection'; END IF;
 IF EXISTS(SELECT FROM read_order_status('status-fixture-other',o))
 OR EXISTS(SELECT FROM read_order_status(NULL,o))
 OR EXISTS(SELECT FROM read_order_status('status-fixture-owner',NULL))
 OR EXISTS(SELECT FROM read_order_status('status-fixture-owner',gen_random_uuid()))
 THEN RAISE EXCEPTION 'order existence or ownership leaked'; END IF;
 PERFORM set_config('mwd.test.status_order',o::text,true);
END $$;
RESET ROLE;
-- Read path does not create a second order or enqueue another operation.
DO $$ BEGIN
 IF (SELECT count(*) FROM orders WHERE actor='status-fixture-owner')<>1
 OR (SELECT count(*) FROM outbox WHERE order_id=current_setting('mwd.test.status_order')::uuid)<>1
 OR EXISTS(SELECT FROM journal WHERE order_id=current_setting('mwd.test.status_order')::uuid)
 THEN RAISE EXCEPTION 'read altered financial state'; END IF;
END $$;
SET LOCAL ROLE mwd_lab_event_service;
DO $$ BEGIN
 BEGIN
  PERFORM read_order_status('status-fixture-owner',current_setting('mwd.test.status_order')::uuid);
  RAISE EXCEPTION 'event service allowed to read order';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
ROLLBACK;
