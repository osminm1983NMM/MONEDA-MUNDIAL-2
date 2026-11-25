-- Read-only structural security checks; not a substitute for authenticated functional tests.
BEGIN TRANSACTION READ ONLY;
DO $gate$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND (n.nspname='public' OR n.nspname LIKE 'mwd%') AND has_function_privilege('anon',p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'Anonymous privileged execution'; END IF;
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname LIKE 'mwd%private' AND has_function_privilege('authenticated',p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'Private privileged execution'; END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('mwd_wallets','mwd_operations','mwd_admin_roles') AND c.relrowsecurity) <> 3 THEN RAISE EXCEPTION 'Missing RLS'; END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename IN ('mwd_wallets','mwd_operations','mwd_admin_roles') AND cmd <> 'SELECT') THEN RAISE EXCEPTION 'Unexpected write policy'; END IF;
END $gate$;
ROLLBACK;
