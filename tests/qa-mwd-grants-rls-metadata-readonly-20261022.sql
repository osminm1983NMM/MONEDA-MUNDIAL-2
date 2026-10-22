-- Moneda Mundial 2.0: puerta de permisos SOLO LABORATORIO.
-- 22 de octubre de 2026. Probado sin cambios en Supabase.
-- Verifica GRANT/RLS de tablas, esquemas privados y privilegios RPC anon.
-- No confirma la autorización completa de SECURITY DEFINER ni valida JWT.
-- Ejecutar desde SQL Editor de Supabase (administrador) o psql.
-- No activa pagos; no modifica datos, fondos, identidades ni permisos.
BEGIN TRANSACTION READ ONLY;
DO $audit$
DECLARE
  n_public int;
  n_private int;
  n_priv_with_rls_off int;
BEGIN
  SELECT count(*) INTO n_public FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r','p') AND n.nspname='public' AND c.relname LIKE 'mwd_%';
  IF n_public < 6 THEN
    RAISE EXCEPTION 'Faltan tablas publicas MWD esperadas';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname='public' AND c.relname LIKE 'mwd_%'
    AND (NOT c.relrowsecurity
      OR has_table_privilege('anon', c.oid, 'SELECT')
      OR has_table_privilege('anon', c.oid, 'INSERT')
      OR has_table_privilege('anon', c.oid, 'UPDATE')
      OR has_table_privilege('anon', c.oid, 'DELETE'))
  ) THEN RAISE EXCEPTION 'Acceso anonimo o RLS desactivado en tablas MWD publicas'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_namespace n WHERE n.nspname LIKE 'mwd_%'
    AND (has_schema_privilege('anon',n.oid,'USAGE')
      OR has_schema_privilege('authenticated',n.oid,'USAGE'))
  ) THEN RAISE EXCEPTION 'Un cliente tiene USAGE en esquema MWD interno'; END IF;

  SELECT count(*),count(*) FILTER(WHERE NOT c.relrowsecurity)
  INTO n_private,n_priv_with_rls_off
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind IN ('r','p') AND n.nspname LIKE 'mwd_%';
  IF n_private < 30 THEN RAISE EXCEPTION 'No se reconocen tablas MWD privadas esperadas'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname LIKE 'mwd_%'
    AND (
      has_table_privilege('anon',c.oid,'SELECT') OR
      has_table_privilege('anon',c.oid,'INSERT') OR
      has_table_privilege('anon',c.oid,'UPDATE') OR
      has_table_privilege('anon',c.oid,'DELETE') OR
      has_table_privilege('authenticated',c.oid,'SELECT') OR
      has_table_privilege('authenticated',c.oid,'INSERT') OR
      has_table_privilege('authenticated',c.oid,'UPDATE') OR
      has_table_privilege('authenticated',c.oid,'DELETE'))
  ) THEN RAISE EXCEPTION 'Acceso directo inesperado a tablas MWD privadas'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'mwd_%'
    AND has_function_privilege('anon',p.oid,'EXECUTE')
  ) THEN RAISE EXCEPTION 'Una RPC MWD es ejecutable por anon'; END IF;
  RAISE NOTICE 'PASS: metadatos de acceso. Revisar RLS adicional en % tablas privadas sin RLS.',n_priv_with_rls_off;
END $audit$;

SELECT 'PASS: MWD grants y RLS publico, auditoria metadata sin cambios' AS status;
ROLLBACK;
