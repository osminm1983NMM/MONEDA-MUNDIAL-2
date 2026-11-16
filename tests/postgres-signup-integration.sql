\set ON_ERROR_STOP on
-- Test en PostgreSQL efimero de CI, JAMAS en Supabase principal.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.mwd_profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id),display_name text NOT NULL);
CREATE TABLE public.mwd_wallets(user_id uuid PRIMARY KEY REFERENCES auth.users(id),balance_cents bigint NOT NULL DEFAULT 1000000);
\ir ../audits/wallet-opening-schema-proposal.sql
\ir ../audits/wallet-opening-trigger-integration-proposal.sql
CREATE TRIGGER mwd_new_auth_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.mwd_handle_new_user();

DO $$ BEGIN
 INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000001');
 IF (SELECT count(*) FROM public.mwd_profiles)<>1 OR (SELECT count(*) FROM public.mwd_wallets)<>1 OR (SELECT count(*) FROM mwd_finance_private.wallet_opening_entries)<>1 THEN RAISE EXCEPTION 'signup missing records'; END IF;
 IF (SELECT opening_amount_cents FROM mwd_finance_private.wallet_opening_entries LIMIT 1)<>1000000 THEN RAISE EXCEPTION 'opening mismatch'; END IF;
 IF has_function_privilege('anon','public.mwd_handle_new_user()','EXECUTE') OR has_function_privilege('authenticated','public.mwd_handle_new_user()','EXECUTE') THEN RAISE EXCEPTION 'function exposed'; END IF;
END $$;

-- Simula un fallo en la ultima escritura y comprueba atomicidad PostgreSQL.
CREATE FUNCTION public.fail_opening_for_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.wallet_user_id='00000000-0000-0000-0000-000000000002'::uuid THEN RAISE EXCEPTION 'injected opening failure'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER test_fail_opening BEFORE INSERT ON mwd_finance_private.wallet_opening_entries FOR EACH ROW EXECUTE FUNCTION public.fail_opening_for_test();
DO $$ BEGIN
 BEGIN
  INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000002');
  RAISE EXCEPTION 'expected failure did not occur';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'injected opening failure' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id='00000000-0000-0000-0000-000000000002') OR EXISTS(SELECT 1 FROM public.mwd_wallets WHERE user_id='00000000-0000-0000-0000-000000000002') OR EXISTS(SELECT 1 FROM public.mwd_profiles WHERE user_id='00000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'partial signup persisted'; END IF;
END $$;
DROP TRIGGER test_fail_opening ON mwd_finance_private.wallet_opening_entries;
DROP FUNCTION public.fail_opening_for_test();

DO $$ BEGIN
 BEGIN
  UPDATE mwd_finance_private.wallet_opening_entries SET opening_amount_cents=1;
  RAISE EXCEPTION 'update unexpectedly allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE <> '42501' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'duplicate unexpectedly allowed';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM mwd_finance_private.wallet_opening_entries)<>1 THEN RAISE EXCEPTION 'duplicate opening'; END IF;
END $$;
SELECT 'POSTGRES_SIGNUP_INTEGRATION_PASS' AS result;
