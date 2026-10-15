-- Auditar funciones financieras en Supabase. SOLO LECTURA.
-- Verificar permisos anónimos y controles de propietario antes de producción.
SELECT
  n.nspname AS schema_name, p.proname, p.prosecdef AS security_definer,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
  strpos(lower(pg_get_functiondef(p.oid)),'auth.uid()') > 0 AS textual_uid_check
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'mwd_%'
ORDER BY p.proname;
-- La presencia textual de auth.uid NO garantiza control correcto. Revisar
-- cada función SECURITY DEFINER manualmente, y hacer pruebas E2E por rol.
SELECT
  n.nspname AS schema_name,
  has_schema_privilege('anon',n.oid,'USAGE') AS anon_usage,
  has_schema_privilege('authenticated',n.oid,'USAGE') AS authenticated_usage
FROM pg_namespace n WHERE n.nspname IN ('mwd_core','mwd_finance_private');
SELECT schemaname,tablename,policyname,roles,cmd FROM pg_policies
WHERE schemaname IN ('mwd_core','mwd_finance_private','public')
ORDER BY schemaname,tablename,policyname;
