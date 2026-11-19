-- Auditoría RLS de Moneda Mundial 2.0. SOLO LECTURA.
-- Inspección estructural; no sustituye pruebas con sesiones A/B.
WITH exposed AS (
 SELECT c.oid,c.relname,c.relrowsecurity
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'mwd_%'
), policy AS (
 SELECT e.relname, count(p.policyname) AS policy_count,
        count(p.policyname) FILTER (WHERE p.cmd='SELECT' AND p.qual LIKE '%auth.uid()%') AS uid_select_policies,
        count(p.policyname) FILTER (WHERE p.cmd='UPDATE' AND p.qual LIKE '%auth.uid()%' AND p.with_check LIKE '%auth.uid()%') AS uid_update_policies
 FROM exposed e LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=e.relname
 GROUP BY e.relname
)
SELECT e.relname AS table_name,e.relrowsecurity AS rls_enabled,
       has_table_privilege('anon',e.oid,'SELECT') AS anon_can_select,
       has_table_privilege('authenticated',e.oid,'SELECT') AS authenticated_can_select,
       p.policy_count,p.uid_select_policies,p.uid_update_policies
FROM exposed e JOIN policy p ON p.relname=e.relname
ORDER BY e.relname;
