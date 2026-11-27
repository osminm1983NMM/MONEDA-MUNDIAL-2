\set ON_ERROR_STOP on
-- Final security regression gate after all disposable schema layers and end-to-end tests.
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE TEMP TABLE expected_exec(role_name text, signature text, PRIMARY KEY(role_name,signature));
INSERT INTO expected_exec VALUES
 ('mwd_lab_order_service','issue_quote(text,text,bigint)'),
 ('mwd_lab_order_service','accept_quote(text,text,uuid,text)'),
 ('mwd_lab_order_service','prepare_authorized(text,uuid,text)'),
 ('mwd_lab_order_service','read_order_status(text,uuid)'),
 ('mwd_lab_status_service','read_bound_order_status(text,uuid)'),
 ('mwd_lab_status_service','resolve_status_binding(uuid)'),
 ('mwd_lab_dispatch_service','claim_dispatch(integer)'),
 ('mwd_lab_dispatch_service','acknowledge_dispatch(text,uuid)'),
 ('mwd_lab_dispatch_service','check_dispatch_lease(text,uuid)'),
 ('mwd_lab_dispatch_service','check_dispatch_submission(text,uuid)'),
 ('mwd_lab_event_service','record_verified_event(text,text,text,text,text,bigint)'),
 ('mwd_lab_statement_service','import_statement_cut(text,text,timestamptz,integer,jsonb)'),
 ('mwd_lab_review_proposer','propose_statement_review(bigint,text,uuid)'),
 ('mwd_lab_review_proposer','propose_refund_recovery(uuid,bigint,uuid,text)'),
 ('mwd_lab_review_approver','approve_statement_review(bigint,text,uuid)'),
 ('mwd_lab_review_approver','approve_refund_recovery(uuid,text)'),
 ('mwd_lab_safety_service','halt_dispatch(text)'),
 ('mwd_lab_resume_proposer','propose_dispatch_resume(bigint,uuid,text)'),
 ('mwd_lab_resume_approver','approve_dispatch_resume(bigint,uuid,text)'),
 ('mwd_lab_multi_order','multi_create(text,bigint,bigint,bigint)'),
 ('mwd_lab_multi_event','multi_apply(text,text,text,bigint,bigint,bigint)'),
 ('mwd_lab_multi_order','multi_attach_transfer(uuid)'),
 ('mwd_lab_multi_event','multi_mirror_accepted(uuid,text)');
CREATE TEMP TABLE expected_audit(name text PRIMARY KEY);
INSERT INTO expected_audit VALUES ('audit_summary'),('journal_summary'),('incident_summary'),
 ('review_summary'),('refund_attention'),('reconciliation_summary'),('review_evidence_summary'),
 ('refund_recovery_summary'),('dispatch_attention'),('ledger_integrity_summary'),
 ('lifecycle_integrity_summary'),('integrity_hold_summary'),('dispatch_control_summary'),('reconciliation_cut_summary'),('reconciliation_capacity_summary'),('multi_balance_summary'),('multi_transfer_summary');
DO $$
DECLARE r record; f record; t record; n oid; permitted boolean; expected boolean; p text;
BEGIN
 SELECT oid INTO STRICT n FROM pg_namespace WHERE nspname='mwd_financial_lab';
 IF (SELECT count(*) FROM pg_roles WHERE rolname LIKE 'mwd_lab_%')<>13 THEN RAISE EXCEPTION 'unexpected service roles'; END IF;
 IF EXISTS(SELECT FROM expected_exec WHERE to_regprocedure(signature) IS NULL) THEN RAISE EXCEPTION 'missing expected endpoint'; END IF;
 IF EXISTS(SELECT FROM expected_audit WHERE to_regclass(name) IS NULL) THEN RAISE EXCEPTION 'missing audit view'; END IF;
 IF EXISTS(SELECT FROM pg_namespace s CROSS JOIN LATERAL aclexplode(coalesce(s.nspacl,acldefault('n',s.nspowner))) a WHERE s.oid=n AND a.grantee=0)
 OR EXISTS(SELECT FROM pg_proc pr CROSS JOIN LATERAL aclexplode(coalesce(pr.proacl,acldefault('f',pr.proowner))) a WHERE pr.pronamespace=n AND a.grantee=0)
 OR EXISTS(SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner))) a WHERE c.relnamespace=n AND c.relkind IN ('r','p','v','m','S','f') AND a.grantee=0)
 THEN RAISE EXCEPTION 'PUBLIC privilege in financial schema'; END IF;
 FOR r IN SELECT * FROM pg_roles WHERE rolname LIKE 'mwd_lab_%' LOOP
  IF r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
   OR EXISTS(SELECT FROM pg_auth_members WHERE member=r.oid)
  THEN RAISE EXCEPTION 'unsafe role %',r.rolname; END IF;
  IF has_database_privilege(r.oid,current_database(),'TEMP') THEN RAISE EXCEPTION 'unexpected temporary table privilege %',r.rolname; END IF;
  IF NOT has_schema_privilege(r.oid,n,'USAGE') OR has_schema_privilege(r.oid,n,'CREATE')
  THEN RAISE EXCEPTION 'schema permission mismatch %',r.rolname; END IF;
  FOR f IN SELECT * FROM pg_proc WHERE pronamespace=n LOOP
   expected:=EXISTS(SELECT FROM expected_exec e WHERE e.role_name=r.rolname AND to_regprocedure(e.signature)=f.oid);
   permitted:=has_function_privilege(r.oid,f.oid,'EXECUTE');
   IF permitted IS DISTINCT FROM expected OR has_function_privilege(r.oid,f.oid,'EXECUTE WITH GRANT OPTION')
   THEN RAISE EXCEPTION 'function permission mismatch % %',r.rolname,f.oid::regprocedure; END IF;
   IF expected AND (NOT f.prosecdef OR NOT EXISTS(SELECT FROM unnest(f.proconfig) c WHERE replace(c,' ','')='search_path=pg_catalog,mwd_financial_lab,pg_temp'))
   THEN RAISE EXCEPTION 'unhardened endpoint %',f.oid::regprocedure; END IF;
  END LOOP;
  FOR t IN SELECT * FROM pg_class WHERE relnamespace=n AND relkind IN ('r','p','v','m','S','f') LOOP
   IF t.relkind='S' THEN
    FOREACH p IN ARRAY ARRAY['USAGE','SELECT','UPDATE'] LOOP
     IF has_sequence_privilege(r.oid,t.oid,p) THEN RAISE EXCEPTION 'sequence privilege % % %',r.rolname,t.relname,p; END IF;
    END LOOP;
   ELSE
    expected:=r.rolname='mwd_lab_audit_service' AND t.relkind='v' AND EXISTS(SELECT FROM expected_audit a WHERE a.name=t.relname);
    IF has_table_privilege(r.oid,t.oid,'SELECT') IS DISTINCT FROM expected
     OR has_any_column_privilege(r.oid,t.oid,'SELECT') IS DISTINCT FROM expected
     OR has_table_privilege(r.oid,t.oid,'SELECT WITH GRANT OPTION')
    THEN RAISE EXCEPTION 'read privilege mismatch % %',r.rolname,t.relname; END IF;
    FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
     IF has_table_privilege(r.oid,t.oid,p) THEN RAISE EXCEPTION 'write privilege % % %',r.rolname,t.relname,p; END IF;
    END LOOP;
    FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','REFERENCES'] LOOP
     IF has_any_column_privilege(r.oid,t.oid,p) THEN RAISE EXCEPTION 'column privilege % % %',r.rolname,t.relname,p; END IF;
    END LOOP;
   END IF;
  END LOOP;
 END LOOP;
END $$;
-- Execute the permitted aggregate views as the actual audit role.
SET LOCAL ROLE mwd_lab_audit_service;
SELECT count(*) FROM audit_summary;
SELECT count(*) FROM journal_summary;
SELECT count(*) FROM incident_summary;
SELECT count(*) FROM review_summary;
SELECT count(*) FROM refund_attention;
SELECT count(*) FROM reconciliation_summary;
SELECT count(*) FROM reconciliation_cut_summary;
SELECT count(*) FROM reconciliation_capacity_summary;
SELECT count(*) FROM review_evidence_summary;
SELECT count(*) FROM refund_recovery_summary;
SELECT count(*) FROM dispatch_attention;
SELECT count(*) FROM ledger_integrity_summary;
SELECT count(*) FROM lifecycle_integrity_summary;
SELECT count(*) FROM integrity_hold_summary;
SELECT count(*) FROM dispatch_control_summary;
SELECT count(*) FROM multi_balance_summary;
SELECT count(*) FROM multi_transfer_summary;
RESET ROLE;
-- The end-to-end worker has completed and all reserved orders should be internally consistent.
DO $$ BEGIN
 IF EXISTS(SELECT FROM ledger_integrity_summary WHERE orders_with_anomalies<>0)
 OR EXISTS(SELECT FROM lifecycle_integrity_summary WHERE orders_with_anomalies<>0)
 OR EXISTS(SELECT FROM integrity_hold_summary)
 OR EXISTS(SELECT FROM multi_transfer_summary WHERE terminal_state_mismatches<>0 OR event_discrepancies<>0)
 THEN RAISE EXCEPTION 'final integrity gate failed'; END IF;
 IF (SELECT halted FROM dispatch_control_summary) THEN RAISE EXCEPTION 'unexpected halt after recovery'; END IF;
END $$;
ROLLBACK;
