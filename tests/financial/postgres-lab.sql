\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
DO $$
DECLARE a uuid; b uuid; ref text; result text; n bigint;
BEGIN
 a:=create_order('A','r1','q1','synthetic',10000);
 IF create_order('A','r1','q1','synthetic',10000)<>a THEN RAISE EXCEPTION 'unstable order'; END IF;
 IF (SELECT count(*) FROM outbox)<>1 THEN RAISE EXCEPTION 'duplicate outbox'; END IF;
 BEGIN PERFORM create_order('A','r1','q1','synthetic',10001); RAISE EXCEPTION 'test failed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'IDEMPOTENCY_CONFLICT' THEN RAISE; END IF; END;
 BEGIN PERFORM prepare_next(a,'payout'); RAISE EXCEPTION 'test failed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_TRANSITION' THEN RAISE; END IF; END;
 ref:=a::text||'-funding';
 BEGIN PERFORM apply_verified_event('mock-remittance','e1',ref,'confirmed','USD',1); RAISE EXCEPTION 'test failed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVENT_MISMATCH' THEN RAISE; END IF; END;
 IF EXISTS(SELECT FROM inbox) OR EXISTS(SELECT FROM journal) OR (SELECT state FROM orders WHERE id=a)<>'funding_pending' THEN RAISE EXCEPTION 'partial mutation'; END IF;
 IF apply_verified_event('mock-remittance','e1',ref,'confirmed','USD',10150)<>'funded' THEN RAISE EXCEPTION 'funding'; END IF;
 IF apply_verified_event('mock-remittance','e1',ref,'confirmed','USD',10150)<>'duplicate' THEN RAISE EXCEPTION 'replay'; END IF;
 BEGIN PERFORM apply_verified_event('mock-remittance','e1',ref,'confirmed','USD',2); RAISE EXCEPTION 'test failed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'EVENT_ID_CONFLICT' THEN RAISE; END IF; END;
 BEGIN PERFORM apply_verified_event('mock-remittance','e2',ref,'confirmed','USD',10150); RAISE EXCEPTION 'test failed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'UNEXPECTED_EVENT_STATE' THEN RAISE; END IF; END;
 ref:=prepare_next(a,'payout');
 IF prepare_next(a,'payout')<>ref THEN RAISE EXCEPTION 'payout retry'; END IF;
 IF apply_verified_event('mock-remittance','e3',ref,'confirmed','HNL',250000)<>'paid' THEN RAISE EXCEPTION 'payout'; END IF;
 IF (SELECT sum(cash) FROM journal)<>150 OR (SELECT sum(payable) FROM journal)<>0 OR (SELECT sum(revenue) FROM journal)<>-150 THEN RAISE EXCEPTION 'paid accounting'; END IF;
 b:=create_order('B','r1','q2','synthetic',10000);
 PERFORM apply_verified_event('mock-remittance','e4',b::text||'-funding','confirmed','USD',10150);
 ref:=prepare_next(b,'payout');
 PERFORM apply_verified_event('mock-remittance','e5',ref,'failed','HNL',250000);
 ref:=prepare_next(b,'refund');
 IF apply_verified_event('mock-remittance','e6',ref,'confirmed','USD',10150)<>'refunded' THEN RAISE EXCEPTION 'refund'; END IF;
 IF (SELECT sum(cash) FROM journal WHERE order_id=b)<>0 OR (SELECT sum(payable) FROM journal WHERE order_id=b)<>0 OR (SELECT sum(revenue) FROM journal WHERE order_id=b)<>0 THEN RAISE EXCEPTION 'refund accounting'; END IF;
 BEGIN UPDATE journal SET cash=cash; RAISE EXCEPTION 'test failed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'APPEND_ONLY' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM inbox)<>5 OR (SELECT count(*) FROM journal)<>4 THEN RAISE EXCEPTION 'event or posting counts'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE n.nspname='mwd_financial_lab' AND a.grantee=0 AND a.privilege_type='USAGE') THEN RAISE EXCEPTION 'public schema exposure'; END IF;
 RAISE NOTICE 'transactional financial sandbox checks passed';
END $$;
ROLLBACK;
