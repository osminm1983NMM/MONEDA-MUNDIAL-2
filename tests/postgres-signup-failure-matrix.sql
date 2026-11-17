\set ON_ERROR_STOP on
-- Ejecutar despues de postgres-signup-integration.sql en base efimera.
CREATE FUNCTION public.inject_signup_failure_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.user_id='00000000-0000-0000-0000-000000000010'::uuid THEN RAISE EXCEPTION 'injected profile failure'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER test_fail_profile BEFORE INSERT ON public.mwd_profiles FOR EACH ROW EXECUTE FUNCTION public.inject_signup_failure_test();
DO $$ BEGIN
 BEGIN
  INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000010');
  RAISE EXCEPTION 'expected profile failure absent';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'injected profile failure' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id='00000000-0000-0000-0000-000000000010') OR EXISTS(SELECT 1 FROM public.mwd_profiles WHERE user_id='00000000-0000-0000-0000-000000000010') OR EXISTS(SELECT 1 FROM public.mwd_wallets WHERE user_id='00000000-0000-0000-0000-000000000010') THEN RAISE EXCEPTION 'profile failure partial records'; END IF;
END $$;
DROP TRIGGER test_fail_profile ON public.mwd_profiles;
DROP FUNCTION public.inject_signup_failure_test();

CREATE FUNCTION public.inject_wallet_failure_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.user_id='00000000-0000-0000-0000-000000000011'::uuid THEN RAISE EXCEPTION 'injected wallet failure'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER test_fail_wallet BEFORE INSERT ON public.mwd_wallets FOR EACH ROW EXECUTE FUNCTION public.inject_wallet_failure_test();
DO $$ BEGIN
 BEGIN
  INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000011');
  RAISE EXCEPTION 'expected wallet failure absent';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'injected wallet failure' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id='00000000-0000-0000-0000-000000000011') OR EXISTS(SELECT 1 FROM public.mwd_profiles WHERE user_id='00000000-0000-0000-0000-000000000011') OR EXISTS(SELECT 1 FROM public.mwd_wallets WHERE user_id='00000000-0000-0000-0000-000000000011') THEN RAISE EXCEPTION 'wallet failure partial records'; END IF;
END $$;
DROP TRIGGER test_fail_wallet ON public.mwd_wallets;
DROP FUNCTION public.inject_wallet_failure_test();

DO $$ BEGIN
 BEGIN
  DELETE FROM mwd_finance_private.wallet_opening_entries;
  RAISE EXCEPTION 'delete unexpectedly allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE <> '42501' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM mwd_finance_private.wallet_opening_entries) < 1 THEN RAISE EXCEPTION 'openings unexpectedly deleted'; END IF;
END $$;
SELECT 'POSTGRES_SIGNUP_FAILURE_MATRIX_PASS' AS result;
