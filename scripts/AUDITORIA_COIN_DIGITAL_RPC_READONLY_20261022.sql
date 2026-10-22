-- MONEDA MUNDIAL 2.0 — AUDITORÍA ESTRUCTURAL Coin ↔ Digital (SOLO DEMO).
-- Laboratorio Supabase; SOLO LECTURA. No contiene datos de usuarios ni fondos.
-- No ejecutar cambios de esquema ni activar criptomonedas, bancos o pagos.
-- No demuestra aislamiento con JWT reales, resistencia a IDOR ni auditoría
-- semántica del cuerpo SECURITY DEFINER. Debe complementarse con pruebas API.
BEGIN TRANSACTION READ ONLY;

DO $audit_coin_digital$
DECLARE
  item record;
  found_functions integer;
  found_tables integer;
BEGIN
  -- Coin/Digital se guarda en un esquema privado no expuesto a clientes.
  IF NOT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname='mwd_swap_private'
  ) THEN
    RAISE EXCEPTION 'FALLA: no existe esquema privado Coin Digital';
  END IF;
  IF has_schema_privilege('anon','mwd_swap_private','USAGE')
     OR has_schema_privilege('authenticated','mwd_swap_private','USAGE') THEN
    RAISE EXCEPTION 'FALLA: clientes tienen USAGE en esquema privado';
  END IF;

  SELECT count(*) INTO found_functions
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
    'mwd_conversion_quote_demo','mwd_conversion_confirm_demo',
    'mwd_conversion_wallet_demo','mwd_conversion_reconcile_demo'
  );
  IF found_functions<>4 THEN
    RAISE EXCEPTION 'FALLA: se esperaban cuatro RPC Coin Digital, encontradas %',
      found_functions;
  END IF;

  FOR item IN
    SELECT p.oid,p.proname,p.prosecdef,p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'mwd_conversion_quote_demo','mwd_conversion_confirm_demo',
      'mwd_conversion_wallet_demo','mwd_conversion_reconcile_demo'
    )
  LOOP
    IF NOT item.prosecdef THEN
      RAISE EXCEPTION 'FALLA: modo no esperado en %',item.proname;
    END IF;
    IF has_function_privilege('anon',item.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'FALLA: RPC accesible por anon: %',item.proname;
    END IF;
    IF NOT has_function_privilege('authenticated',item.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'FALLA: RPC no disponible al rol autenticado: %',item.proname;
    END IF;
    IF item.proconfig IS NULL OR NOT EXISTS (
      SELECT 1 FROM unnest(item.proconfig) setting WHERE setting LIKE 'search_path=%'
    ) THEN
      RAISE EXCEPTION 'FALLA: search_path sin fijar: %',item.proname;
    END IF;
    -- Control de presencia textual, NO verificación de semántica/autorización.
    IF position('auth.uid()' in pg_get_functiondef(item.oid))=0 THEN
      RAISE EXCEPTION 'FALLA: revisión de auth.uid ausente: %',item.proname;
    END IF;
  END LOOP;

  SELECT count(*) INTO found_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='mwd_swap_private' AND c.relkind IN ('r','p');
  IF found_tables<7 THEN
    RAISE EXCEPTION 'FALLA: número inesperado de tablas privadas: %',found_tables;
  END IF;
  FOR item IN
    SELECT c.oid,c.relname,c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='mwd_swap_private' AND c.relkind IN ('r','p')
  LOOP
    IF NOT item.relrowsecurity THEN
      RAISE EXCEPTION 'FALLA: RLS no activo: %',item.relname;
    END IF;
    IF has_table_privilege('anon',item.oid,'SELECT')
       OR has_table_privilege('anon',item.oid,'INSERT')
       OR has_table_privilege('anon',item.oid,'UPDATE')
       OR has_table_privilege('anon',item.oid,'DELETE')
       OR has_table_privilege('authenticated',item.oid,'SELECT')
       OR has_table_privilege('authenticated',item.oid,'INSERT')
       OR has_table_privilege('authenticated',item.oid,'UPDATE')
       OR has_table_privilege('authenticated',item.oid,'DELETE') THEN
      RAISE EXCEPTION 'FALLA: acceso directo a tabla privada: %',item.relname;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS SOLO DEMO: 4 RPC, esquema privado, % tablas con RLS y sin permisos directos; solo metadatos', found_tables;
END;
$audit_coin_digital$;

ROLLBACK;
