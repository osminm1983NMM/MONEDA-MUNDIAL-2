\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
-- Legacy complete empty batch cannot be represented as a validated cut.
SELECT import_statement('legacy-cut-test',true,'[]');
SET LOCAL ROLE mwd_lab_statement_service;
DO $$
DECLARE stamp timestamptz:=clock_timestamp(); b uuid;
BEGIN
 b:=import_statement_cut('cut-test','US-HN:all-funding-payout-refund',stamp,0,'[]');
 IF import_statement_cut('cut-test','US-HN:all-funding-payout-refund',stamp,0,'[]')<>b THEN RAISE EXCEPTION 'replay changed id'; END IF;
 BEGIN PERFORM import_statement_cut('cut-test','US-HN:all-funding-payout-refund',stamp-interval '1 second',0,'[]'); RAISE EXCEPTION 'changed cut accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'CUT_ID_CONFLICT' THEN RAISE; END IF; END;
 BEGIN PERFORM import_statement_cut('legacy-cut-test','US-HN:all-funding-payout-refund',stamp,0,'[]'); RAISE EXCEPTION 'legacy promotion accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'CUT_ID_CONFLICT' THEN RAISE; END IF; END;
 BEGIN PERFORM import_statement_cut('wrong-count','US-HN:all-funding-payout-refund',stamp,1,'[]'); RAISE EXCEPTION 'bad count accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'CUT_COUNT_MISMATCH' THEN RAISE; END IF; END;
 BEGIN PERFORM import_statement_cut('wrong-scope','US-SV',stamp,0,'[]'); RAISE EXCEPTION 'bad scope accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_CUT_ENVELOPE' THEN RAISE; END IF; END;
 BEGIN PERFORM import_statement_cut('old-cut','US-HN:all-funding-payout-refund',stamp-interval '2 minutes',0,'[]'); RAISE EXCEPTION 'stale cut accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'CUT_NOT_CURRENT' THEN RAISE; END IF; END;
 BEGIN PERFORM import_statement_cut('future-cut','US-HN:all-funding-payout-refund',stamp+interval '2 minutes',0,'[]'); RAISE EXCEPTION 'future cut accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'CUT_NOT_CURRENT' THEN RAISE; END IF; END;
 BEGIN PERFORM import_statement_cut('repeat-cut','US-HN:all-funding-payout-refund',stamp,0,'[]'); RAISE EXCEPTION 'nonadvancing cut accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'CUT_NOT_ADVANCING' THEN RAISE; END IF; END;
 BEGIN PERFORM import_statement('raw-bypass',true,'[]'); RAISE EXCEPTION 'raw import allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM count(*) FROM statement_cut_metadata; RAISE EXCEPTION 'private metadata exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 IF (SELECT count(*) FROM reconciliation_cut_summary WHERE clean)<>1 THEN RAISE EXCEPTION 'expected only explicit cut'; END IF;
 IF EXISTS(SELECT FROM reconciliation_cut_summary WHERE provider_as_of IS NULL AND (clean OR matched_usd_minor IS NOT NULL)) THEN RAISE EXCEPTION 'legacy cut exposed as clean'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_statement_service;
DO $$
DECLARE
 base_row jsonb := '{"mode":"sandbox","reference":"synthetic","kind":"funding","currency":"USD","amountMinor":9007199254740991,"status":"confirmed"}';
 bad_row jsonb;
BEGIN
 FOREACH bad_row IN ARRAY ARRAY[
  'null'::jsonb, '1'::jsonb, '[]'::jsonb,
  jsonb_set(base_row,'{reference}','123'),
  jsonb_set(base_row,'{reference}','null'),
  jsonb_set(base_row,'{kind}','"other"'),
  jsonb_set(base_row,'{currency}','"HNL"'),
  jsonb_set(base_row,'{status}','"settled"'),
  jsonb_set(base_row,'{amountMinor}','"1"'),
  jsonb_set(base_row,'{amountMinor}','1.5'),
  jsonb_set(base_row,'{amountMinor}','9007199254740992')
 ] LOOP
  BEGIN
   PERFORM import_statement_cut('strict-cut-test','US-HN:all-funding-payout-refund',clock_timestamp(),1,jsonb_build_array(bad_row));
   RAISE EXCEPTION 'malformed statement row accepted: %', bad_row;
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'INVALID_STATEMENT_ROW' THEN RAISE; END IF;
  END;
 END LOOP;
 PERFORM import_statement_cut('strict-cut-test','US-HN:all-funding-payout-refund',clock_timestamp(),1,jsonb_build_array(base_row));
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM statement_batches WHERE external_id='strict-cut-test') <> 1
 OR NOT EXISTS (
  SELECT FROM statement_external e JOIN statement_batches b ON b.id=e.batch_id
  WHERE b.external_id='strict-cut-test' AND e.amount_minor=9007199254740991
 ) THEN RAISE EXCEPTION 'valid exact amount missing after rejected imports'; END IF;
END $$;
ROLLBACK;
