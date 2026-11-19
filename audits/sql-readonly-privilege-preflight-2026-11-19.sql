-- MONEDA MUNDIAL 2.0: reproducible privilege/security preflight.
-- READ ONLY. This does not impersonate users or verify runtime RLS.
WITH privileged_functions AS (
  SELECT p.oid,p.proconfig,pg_get_functiondef(p.oid) AS source
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef AND p.proname LIKE 'mwd_%'
), private_tables AS (
  SELECT c.oid,c.relrowsecurity FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname LIKE 'mwd_%private' AND c.relkind='r'
)
SELECT
  (SELECT count(*) FROM privileged_functions) AS privileged_functions,
  (SELECT count(*) FROM privileged_functions f WHERE has_function_privilege('anon',f.oid,'EXECUTE')) AS anon_executable,
  (SELECT count(*) FROM privileged_functions f WHERE NOT EXISTS
    (SELECT 1 FROM unnest(f.proconfig) x WHERE x LIKE 'search_path=%')) AS without_fixed_search_path,
  (SELECT count(*) FROM privileged_functions WHERE source ~* 'raw_user_meta_data|user_metadata') AS user_metadata_mentions,
  (SELECT count(*) FROM privileged_functions WHERE source ~* 'EXECUTE[[:space:]]') AS dynamic_sql_mentions,
  (SELECT count(*) FROM private_tables) AS private_tables,
  (SELECT count(*) FROM private_tables WHERE NOT relrowsecurity) AS private_without_rls,
  (SELECT count(*) FROM private_tables t WHERE has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE')) AS private_anon_any_dml,
  (SELECT count(*) FROM private_tables t WHERE has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE')) AS private_authenticated_any_dml;
