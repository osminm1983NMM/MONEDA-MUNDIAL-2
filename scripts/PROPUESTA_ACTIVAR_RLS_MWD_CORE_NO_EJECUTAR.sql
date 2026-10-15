-- PROPUESTA PARA REVISIÓN (NO EJECUTADA).
-- Moneda Mundial 2.0 - 4 tablas técnicas de mwd_core.
-- NO la ejecute sin decisión expresa sobre políticas, validación en staging
-- y plan de reversión. No permite operaciones con dinero real.
--
-- Diseño previsto: estas tablas internas NO son consultables desde clientes.
-- No crear políticas RLS de acceso anon/authenticated.
-- Los propietarios de tablas pueden eludir RLS (sin FORCE RLS).
-- Los grants son una barrera adicional y deben seguir revocados.

BEGIN;

DO $rls_precheck$
DECLARE
  table_name text;
  target_oid oid;
BEGIN
  IF has_schema_privilege('anon','mwd_core','USAGE')
      OR has_schema_privilege('authenticated','mwd_core','USAGE') THEN
    RAISE EXCEPTION 'ABORTAR: un rol público tiene USAGE sobre mwd_core';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'currencies','countries','country_currencies','payment_corridors'
  ] LOOP
    SELECT c.oid INTO target_oid
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='mwd_core' AND c.relname=table_name AND c.relkind='r';
    IF target_oid IS NULL THEN
      RAISE EXCEPTION 'ABORTAR: no existe mwd_core.%',table_name;
    END IF;
    IF has_table_privilege('anon',target_oid,'SELECT')
      OR has_table_privilege('anon',target_oid,'INSERT')
      OR has_table_privilege('anon',target_oid,'UPDATE')
      OR has_table_privilege('anon',target_oid,'DELETE')
      OR has_table_privilege('authenticated',target_oid,'SELECT')
      OR has_table_privilege('authenticated',target_oid,'INSERT')
      OR has_table_privilege('authenticated',target_oid,'UPDATE')
      OR has_table_privilege('authenticated',target_oid,'DELETE')
    THEN
      RAISE EXCEPTION 'ABORTAR: hay privilegios directos de cliente en mwd_core.%',table_name;
    END IF;
  END LOOP;
END
$rls_precheck$;

-- La política prevista es DENEGAR acceso directo de cliente: ninguna política
-- SELECT/INSERT/UPDATE/DELETE para roles anon/authenticated.
ALTER TABLE mwd_core.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_core.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_core.country_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_core.payment_corridors ENABLE ROW LEVEL SECURITY;

-- No usar FORCE ROW LEVEL SECURITY sin revisar propietarios,
-- funciones internas y acceso de backend.
COMMIT;

-- Después de aplicar: ejecutar validar_rls_mwd_core_readonly.sql y pruebas
-- funcionales de saldo, países, simulador y roles. No habilitar rutas reales.
