-- Validación no destructiva posterior a la propuesta de RLS, en PostgreSQL AISLADO.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='mwd_core' AND c.relkind='r'
  LOOP
    IF NOT t.relrowsecurity THEN RAISE EXCEPTION 'Falta RLS en %',t.relname; END IF;
    IF t.relforcerowsecurity THEN RAISE EXCEPTION 'FORCE RLS no solicitado en %',t.relname; END IF;
    IF has_table_privilege('anon',t.oid,'SELECT') OR
       has_table_privilege('authenticated',t.oid,'SELECT') OR
       has_table_privilege('authenticated',t.oid,'UPDATE') THEN
      RAISE EXCEPTION 'Permisos de cliente inesperados en %',t.relname;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='mwd_core' AND c.relkind='r') <> 4
  THEN RAISE EXCEPTION 'Se esperaban cuatro tablas mwd_core'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mwd_core') THEN
    RAISE EXCEPTION 'No deberían existir políticas de cliente en el esquema aislado';
  END IF;
  IF has_schema_privilege('anon','mwd_core','USAGE') OR
     has_schema_privilege('authenticated','mwd_core','USAGE') THEN
    RAISE EXCEPTION 'USAGE otorgado a usuarios del cliente';
  END IF;
END $$;

-- El propietario sigue pudiendo consultar y el corredor continúa deshabilitado.
SELECT 'RLS OK - respaldo de lectura interna' AS result
WHERE (SELECT count(*) FROM mwd_core.currencies)=2
 AND (SELECT count(*) FROM mwd_core.countries)=2
 AND (SELECT count(*) FROM mwd_core.country_currencies)=2
 AND (SELECT count(*) FROM mwd_core.payment_corridors WHERE status='disabled')=1;
