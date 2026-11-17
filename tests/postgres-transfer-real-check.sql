\set ON_ERROR_STOP on
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000040',false);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.mwd_transfer_demo('MWD-TEST41',700000,'00000000-0000-0000-0000-000000000050');
 IF r->>'status'<>'ok' THEN RAISE EXCEPTION 'first transfer failed'; END IF;
 r:=public.mwd_transfer_demo('MWD-TEST41',700000,'00000000-0000-0000-0000-000000000050');
 IF r->>'status'<>'already_processed' THEN RAISE EXCEPTION 'replay failed'; END IF;
 BEGIN
  PERFORM public.mwd_transfer_demo('MWD-TEST42',700000,'00000000-0000-0000-0000-000000000050');
  RAISE EXCEPTION 'reused request unexpectedly allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Identificador ya usado para otra operacion' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.mwd_transfer_demo('MWD-TEST42',700000,'00000000-0000-0000-0000-000000000051');
  RAISE EXCEPTION 'overspend unexpectedly allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Saldo ficticio insuficiente' THEN RAISE; END IF; END;
 IF (SELECT balance_cents FROM public.mwd_wallets WHERE user_id='00000000-0000-0000-0000-000000000040')<>300000 THEN RAISE EXCEPTION 'sender mismatch'; END IF;
 IF (SELECT sum(balance_cents) FROM public.mwd_wallets WHERE user_id IN ('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000042'))<>3000000 THEN RAISE EXCEPTION 'sum mismatch'; END IF;
 IF (SELECT count(*) FROM public.mwd_operations WHERE actor_id='00000000-0000-0000-0000-000000000040')<>1 THEN RAISE EXCEPTION 'operation count mismatch'; END IF;
END $$;
SELECT 'POSTGRES_REAL_TRANSFER_FUNCTION_PASS' AS result;
