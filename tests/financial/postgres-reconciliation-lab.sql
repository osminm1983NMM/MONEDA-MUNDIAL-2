\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
INSERT INTO actor_policy VALUES ('statementA','verified','clear','allow',50000);
INSERT INTO beneficiaries VALUES ('statementA','beneficiary','verified');
SET LOCAL ROLE mwd_lab_order_service;
SELECT quote_id FROM issue_quote('statementA','beneficiary',10000) \gset q_
SELECT accept_quote('statementA','r1',:'q_quote_id','sandbox-disclosure-v1') AS id \gset o_
RESET ROLE;
SET LOCAL ROLE mwd_lab_event_service;
SELECT record_verified_event('mock-remittance','statement-fund',:'o_id'||'-funding','confirmed','USD',10150);
RESET ROLE;
SET LOCAL ROLE mwd_lab_order_service;
SELECT prepare_authorized('statementA',:'o_id','payout');
RESET ROLE;
SET LOCAL ROLE mwd_lab_event_service;
SELECT record_verified_event('mock-remittance','statement-payout',:'o_id'||'-payout','confirmed','HNL',250000);
RESET ROLE;
-- Independent fixture, not calculated from the internal outbox or journal.
SELECT set_config('mwd.test.rows',jsonb_build_array(
 jsonb_build_object('mode','sandbox','reference',:'o_id'||'-funding','kind','funding','currency','USD','amountMinor',10150,'status','confirmed'),
 jsonb_build_object('mode','sandbox','reference',:'o_id'||'-payout','kind','payout','currency','HNL','amountMinor',250000,'status','confirmed'))::text,true);
SET LOCAL ROLE mwd_lab_statement_service;
DO $$
DECLARE rows jsonb:=current_setting('mwd.test.rows')::jsonb; b uuid;
BEGIN
 b:=import_statement('clean-statement',true,rows);
 IF import_statement('clean-statement',true,rows)<>b THEN RAISE EXCEPTION 'import replay changed id'; END IF;
 BEGIN PERFORM import_statement('clean-statement',false,rows); RAISE EXCEPTION 'changed batch accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'STATEMENT_ID_CONFLICT' THEN RAISE; END IF; END;
 PERFORM import_statement('partial-statement',false,rows);
 PERFORM import_statement('missing-statement',true,jsonb_build_array(rows->0));
 PERFORM import_statement('duplicate-statement',true,rows||jsonb_build_array(rows->0));
 PERFORM import_statement('mismatch-statement',true,jsonb_set(rows,'{0,amountMinor}','9999'));
 PERFORM import_statement('status-statement',true,jsonb_set(rows,'{0,status}','"pending"'));
 PERFORM import_statement('unknown-statement',true,rows||jsonb_build_array(jsonb_set(rows->0,'{reference}','"unknown"')));
 BEGIN PERFORM import_statement('bad-row',true,jsonb_set(rows,'{0,mode}','"production"')); RAISE EXCEPTION 'non synthetic accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_STATEMENT_ROW' THEN RAISE; END IF; END;
 BEGIN PERFORM record_verified_event('mock-remittance','fake','fake','confirmed','USD',1); RAISE EXCEPTION 'statement role can settle'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM count(*) FROM journal; RAISE EXCEPTION 'statement role can read journal'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$
DECLARE b uuid; s reconciliation_summary%ROWTYPE; c bigint;
BEGIN
 SELECT id INTO b FROM statement_batches WHERE external_id='clean-statement';
 SELECT * INTO s FROM reconciliation_summary WHERE batch_id=b;
 IF NOT s.clean OR s.discrepancy_count<>0 OR s.matched_usd_minor<>10150 OR s.matched_hnl_minor<>-250000 THEN RAISE EXCEPTION 'clean reconciliation wrong'; END IF;
 IF (SELECT count(*) FROM reconciliation_summary WHERE clean)<>1 THEN RAISE EXCEPTION 'dirty or incomplete statement passed'; END IF;
 SELECT count(*) INTO c FROM reconciliation_details WHERE result IN ('MISSING_PROVIDER','DUPLICATE_REFERENCE','VALUE_MISMATCH','STATUS_MISMATCH','UNKNOWN_PROVIDER');
 IF c<>5 THEN RAISE EXCEPTION 'missing discrepancy classifications: %',c; END IF;
 BEGIN UPDATE statement_batches SET complete=false; RAISE EXCEPTION 'statement mutation allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'APPEND_ONLY' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM journal j JOIN orders o ON o.id=j.order_id WHERE o.actor='statementA')<>2 THEN RAISE EXCEPTION 'reconciliation modified journal'; END IF;
END $$;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 IF (SELECT count(*) FROM reconciliation_summary)<>7 THEN RAISE EXCEPTION 'audit summary unavailable'; END IF;
 BEGIN PERFORM count(*) FROM statement_external; RAISE EXCEPTION 'raw statement accessible'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
