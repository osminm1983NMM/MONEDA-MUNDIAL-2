BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
-- Reuse the already completed signed-worker fixtures. Do not send any new payment.
DO $$
DECLARE p uuid; r uuid; result text;
BEGIN
 SELECT id INTO STRICT p FROM orders WHERE actor='workerPaid';
 SELECT id INTO STRICT r FROM orders WHERE actor='workerRefund';
 IF (SELECT state FROM orders WHERE id=p)<>'paid' OR (SELECT state FROM orders WHERE id=r)<>'refunded' THEN RAISE EXCEPTION 'EXPECTED_WORKER_FIXTURES'; END IF;
 PERFORM set_config('mwd.test_paid',p::text,true);
 PERFORM set_config('mwd.test_refund',r::text,true);
END $$;
SET LOCAL ROLE mwd_lab_multi_order;
DO $$ DECLARE p uuid:=current_setting('mwd.test_paid')::uuid; r uuid:=current_setting('mwd.test_refund')::uuid; BEGIN
 IF multi_attach_transfer(p)<>'attached' OR multi_attach_transfer(p)<>'duplicate' THEN RAISE EXCEPTION 'ATTACH_FAILED'; END IF;
 PERFORM multi_attach_transfer(r);
 BEGIN PERFORM multi_attach_transfer(gen_random_uuid()); RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'TRANSFER_UNAVAILABLE' THEN RAISE; END IF; END;
 BEGIN PERFORM multi_mirror_accepted(p,'worker-fund-1'); RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $ BEGIN
 IF NOT EXISTS(SELECT FROM multi_transfer_summary WHERE linked_transfers=2 AND terminal_state_mismatches=2 AND event_discrepancies>0) THEN RAISE EXCEPTION 'MISSING_HISTORY_NOT_DETECTED'; END IF;
END $;
SET LOCAL ROLE mwd_lab_multi_event;
DO $$ DECLARE p uuid:=current_setting('mwd.test_paid')::uuid; r uuid:=current_setting('mwd.test_refund')::uuid; BEGIN
 BEGIN PERFORM multi_mirror_accepted(p,'worker-fund-2'); RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ACCEPTED_EVENT_UNAVAILABLE' THEN RAISE; END IF; END;
 BEGIN PERFORM multi_apply(p::text,'fabricated-funding','funding_confirmed',10150,NULL,NULL); RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ACCEPTED_EVENT_REQUIRED' THEN RAISE; END IF; END;
 BEGIN PERFORM multi_apply(p::text,'worker-fund-1','funding_confirmed',10149,NULL,NULL); RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ACCEPTED_EVENT_REQUIRED' THEN RAISE; END IF; END;
 IF multi_mirror_accepted(p,'worker-fund-1')<>'funded' THEN RAISE EXCEPTION 'FUNDING_MIRROR'; END IF;
 BEGIN PERFORM multi_mirror_accepted(p,'worker-pay-1'); RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_TRANSITION' THEN RAISE; END IF; END;
 -- Explicit synthetic FX fixture; never inferred from payout.
 PERFORM multi_apply(p::text,'bridge-fixture-fx','fx_acquired',10000,250000,0);
 BEGIN PERFORM multi_apply(p::text,'fabricated-payout','payout_confirmed',NULL,250000,NULL); RAISE EXCEPTION 'EXPECTED_REJECTION'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ACCEPTED_EVENT_REQUIRED' THEN RAISE; END IF; END;
 IF multi_mirror_accepted(p,'worker-pay-1')<>'paid' OR multi_mirror_accepted(p,'worker-pay-1')<>'duplicate' THEN RAISE EXCEPTION 'PAYOUT_MIRROR'; END IF;
 PERFORM multi_mirror_accepted(r,'worker-fund-2');
END $$;
RESET ROLE;
-- Read the actual accepted refund path, including the recovered confirmation.
DO $$ DECLARE r uuid:=current_setting('mwd.test_refund')::uuid; e record; BEGIN
 FOR e IN SELECT i.event_id FROM inbox i JOIN outbox x ON x.reference=i.reference WHERE x.order_id=r AND x.kind='payout' AND i.outcome='failed' LOOP
  PERFORM multi_mirror_accepted(r,e.event_id);
 END LOOP;
 IF multi_mirror_accepted(r,'worker-refund-2')<>'refunded' THEN RAISE EXCEPTION 'REFUND_MIRROR'; END IF;
 IF EXISTS(SELECT FROM multi_transfer_summary WHERE linked_transfers<>2 OR terminal_state_mismatches<>0 OR event_discrepancies<>0) THEN RAISE EXCEPTION 'MIRROR_DISCREPANCY'; END IF;
END $$;
SET LOCAL ROLE mwd_lab_audit_service;
SELECT * FROM multi_transfer_summary;
RESET ROLE;
COMMIT;
