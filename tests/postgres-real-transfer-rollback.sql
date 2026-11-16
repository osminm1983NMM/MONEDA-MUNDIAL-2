\set ON_ERROR_STOP on
-- Run after real-transfer-function.sql and concurrency test, on isolated PostgreSQL only.
CREATE FUNCTION public.test_fail_operation_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.request_id='00000000-0000-0000-0000-000000000080'::uuid THEN RAISE EXCEPTION 'injected operation insert failure'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER test_fail_operation_insert BEFORE INSERT ON public.mwd_operations FOR EACH ROW EXECUTE FUNCTION public.test_fail_operation_insert();
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000040',false);
DO $$ DECLARE before_sender bigint; before_recipient bigint; before_count bigint; BEGIN
 SELECT balance_cents INTO before_sender FROM public.mwd_wallets WHERE user_id='00000000-0000-0000-0000-000000000040';
 SELECT balance_cents INTO before_recipient FROM public.mwd_wallets WHERE user_id='00000000-0000-0000-0000-000000000042';
 SELECT count(*) INTO before_count FROM public.mwd_operations;
 BEGIN
  PERFORM public.mwd_transfer_demo('MWD-TEST42',1000,'00000000-0000-0000-0000-000000000080');
  RAISE EXCEPTION 'injected failure did not occur';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'injected operation insert failure' THEN RAISE; END IF;
 END;
 IF (SELECT balance_cents FROM public.mwd_wallets WHERE user_id='00000000-0000-0000-0000-000000000040')<>before_sender THEN RAISE EXCEPTION 'sender not rolled back'; END IF;
 IF (SELECT balance_cents FROM public.mwd_wallets WHERE user_id='00000000-0000-0000-0000-000000000042')<>before_recipient THEN RAISE EXCEPTION 'recipient not rolled back'; END IF;
 IF (SELECT count(*) FROM public.mwd_operations)<>before_count THEN RAISE EXCEPTION 'unexpected operation persisted'; END IF;
END $$;
DROP TRIGGER test_fail_operation_insert ON public.mwd_operations;
DROP FUNCTION public.test_fail_operation_insert();
SELECT 'POSTGRES_REAL_TRANSFER_ROLLBACK_PASS' AS result;
