\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=pg_catalog,mwd_financial_lab,pg_temp;
INSERT INTO actor_policy VALUES
 ('00000000-0000-4000-8000-000000000010','verified','clear','allow',50000),
 ('00000000-0000-4000-8000-000000000020','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('00000000-0000-4000-8000-000000000010','beneficiary','verified');
INSERT INTO status_bindings VALUES ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000010',true);
SET LOCAL ROLE mwd_lab_order_service;
SELECT quote_id FROM issue_quote('00000000-0000-4000-8000-000000000010','beneficiary',10000) \gset binding_
SELECT accept_quote('00000000-0000-4000-8000-000000000010','binding-test',:'binding_quote_id','sandbox-disclosure-v1') AS order_id \gset binding_
RESET ROLE;
SELECT set_config('mwd.test.binding_order',:'binding_order_id',true);
SET LOCAL ROLE mwd_lab_status_service;
DO $$
DECLARE a constant text:='00000000-0000-4000-8000-000000000010'; b constant text:='00000000-0000-4000-8000-000000000020'; o uuid:=current_setting('mwd.test.binding_order')::uuid;
BEGIN
 IF NOT EXISTS(SELECT FROM resolve_status_binding(a::uuid) WHERE active AND actor=a AND environment='sandbox')
 OR EXISTS(SELECT FROM resolve_status_binding(b::uuid))
 OR NOT EXISTS(SELECT FROM read_bound_order_status(a,o) WHERE total_minor=10150 AND status='funding_pending')
 OR EXISTS(SELECT FROM read_bound_order_status(b,o))
 THEN RAISE EXCEPTION 'binding projection mismatch'; END IF;
 BEGIN PERFORM read_order_status(a,o); RAISE EXCEPTION 'unbound read permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM issue_quote(a,'beneficiary',10000); RAISE EXCEPTION 'write endpoint permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE status_bindings SET active=true; RAISE EXCEPTION 'registry write permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE status_bindings SET active=false;
SET LOCAL ROLE mwd_lab_status_service;
DO $$ BEGIN
 IF EXISTS(SELECT FROM read_bound_order_status('00000000-0000-4000-8000-000000000010',current_setting('mwd.test.binding_order')::uuid))
 THEN RAISE EXCEPTION 'disabled identity permitted'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
