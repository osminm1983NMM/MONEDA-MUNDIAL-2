BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
SET LOCAL ROLE mwd_lab_multi_order;
DO $$ BEGIN
 IF multi_create('multi-paid',10000,150,250000)<>'created' OR multi_create('multi-paid',10000,150,250000)<>'duplicate' THEN RAISE EXCEPTION 'CREATE_FAILED'; END IF;
 PERFORM multi_create('multi-refund',10000,150,250000);
 BEGIN PERFORM multi_create('multi-paid',10000,151,250000); RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ORDER_ID_CONFLICT' THEN RAISE; END IF; END;
 BEGIN PERFORM multi_apply('multi-paid','unauthorized','funding_confirmed',10150,NULL,NULL); RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE mwd_lab_multi_event;
DO $$ BEGIN
 IF multi_apply('multi-paid','multi-f1','funding_confirmed',10150,NULL,NULL)<>'funded' THEN RAISE EXCEPTION 'FUNDING_FAILED'; END IF;
 BEGIN PERFORM multi_apply('multi-paid','multi-bad','fx_acquired',10000,250001,40); RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'AMOUNT_MISMATCH' THEN RAISE; END IF; END;
 PERFORM multi_apply('multi-paid','multi-fx1','fx_acquired',10000,250000,40);
 IF multi_apply('multi-paid','multi-p1','payout_confirmed',NULL,250000,NULL)<>'paid' THEN RAISE EXCEPTION 'PAYOUT_FAILED'; END IF;
 IF multi_apply('multi-paid','multi-f1','funding_confirmed',10150,NULL,NULL)<>'duplicate' THEN RAISE EXCEPTION 'REPLAY_FAILED'; END IF;
 BEGIN PERFORM multi_apply('multi-refund','multi-f1','funding_confirmed',10150,NULL,NULL); RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVENT_ID_CONFLICT' THEN RAISE; END IF; END;
 PERFORM multi_apply('multi-refund','multi-f2','funding_confirmed',10150,NULL,NULL);
 PERFORM multi_apply('multi-refund','multi-fx2','fx_acquired',10000,250000,40);
 PERFORM multi_apply('multi-refund','multi-fail2','payout_failed',NULL,NULL,NULL);
 BEGIN PERFORM multi_apply('multi-refund','multi-r2','refund_confirmed',10150,NULL,NULL); RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_TRANSITION' THEN RAISE; END IF; END;
 PERFORM multi_apply('multi-refund','multi-unwind2','fx_unwound',10000,250000,20);
 IF multi_apply('multi-refund','multi-r2','refund_confirmed',10150,NULL,NULL)<>'refunded' THEN RAISE EXCEPTION 'REFUND_FAILED'; END IF;
 BEGIN UPDATE multi_orders SET state='paid'; RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM multi_events)<>8 OR (SELECT count(*) FROM multi_journal)<>11 OR EXISTS(SELECT FROM multi_events WHERE id='multi-bad') THEN RAISE EXCEPTION 'POSTING_COUNT'; END IF;
 IF NOT EXISTS(SELECT FROM multi_balance_summary WHERE currency='USD' AND cash=50 AND payable=0 AND bridge=0 AND revenue=-150 AND expense=100) THEN RAISE EXCEPTION 'USD_BALANCE'; END IF;
 IF NOT EXISTS(SELECT FROM multi_balance_summary WHERE currency='HNL' AND cash=0 AND bridge=0) THEN RAISE EXCEPTION 'HNL_BALANCE'; END IF;
 BEGIN DELETE FROM multi_journal; RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'APPEND_ONLY' THEN RAISE; END IF; END;
END $$;
SET LOCAL ROLE mwd_lab_audit_service;
DO $$ BEGIN
 IF (SELECT count(*) FROM multi_balance_summary)<>2 THEN RAISE EXCEPTION 'AUDIT_FAILED'; END IF;
 BEGIN PERFORM 1 FROM multi_events; RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
COMMIT;
