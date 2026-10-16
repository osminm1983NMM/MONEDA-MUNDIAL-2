-- Aserciones para registrar futuros bancos y agentes SOLO en demostración.
-- Se ejecuta después de partner-registry-fixture.sql y
-- database/mwd_secure_partner_registry_demo.sql, en PostgreSQL desechable.

DO $$
DECLARE c integer;
BEGIN
 SELECT count(*) INTO c FROM pg_class t
 JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE n.nspname='mwd_partners_private' AND t.relkind='r' AND t.relrowsecurity;
 IF c<>3 THEN RAISE EXCEPTION 'Las tres tablas privadas deben usar RLS'; END IF;
 IF has_schema_privilege('authenticated','mwd_partners_private','USAGE')
   OR has_schema_privilege('anon','mwd_partners_private','USAGE')
 THEN RAISE EXCEPTION 'Acceso inesperado a esquema privado'; END IF;
 IF has_table_privilege('authenticated','mwd_partners_private.partners','SELECT')
   OR has_table_privilege('authenticated','mwd_partners_private.locations','INSERT')
 THEN RAISE EXCEPTION 'Privilegios de tablas privadas expuestos'; END IF;
 IF has_function_privilege('anon','public.mwd_owner_partners_demo()','EXECUTE')
 THEN RAISE EXCEPTION 'Anon no debe ejecutar API de socios'; END IF;
END $$;

-- Verificar que las RPC rechazan usuarios no administradores.
SET ROLE authenticated;
SET request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $$
BEGIN
 BEGIN
  PERFORM public.mwd_owner_partners_demo();
  RAISE EXCEPTION 'FALLO: usuario normal accedió al registro';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM public.mwd_owner_partner_save_demo('Banco falso','bank','NI');
  RAISE EXCEPTION 'FALLO: usuario normal creó un socio';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;

-- Sólo el propietario ficticio puede crear y revisar candidatos.
SET request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$
DECLARE p uuid; l uuid; result jsonb; status text; n integer;
BEGIN
 result := public.mwd_owner_partner_save_demo('Banco ficticio CI','bank','NI');
 p := (result->>'id')::uuid;
 IF result->>'real_payouts_enabled'<>'false' THEN
   RAISE EXCEPTION 'Se habilitaron pagos reales';
 END IF;
 SELECT review_status INTO status FROM public.mwd_owner_partners_demo() WHERE id=p;
 IF status<>'draft' THEN RAISE EXCEPTION 'Estado inicial no es borrador'; END IF;

 BEGIN
  PERFORM public.mwd_owner_partner_set_status_demo(p,'documented');
  RAISE EXCEPTION 'FALLO: permitió saltarse revisión';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 PERFORM public.mwd_owner_partner_set_status_demo(p,'under_review');
 PERFORM public.mwd_owner_partner_set_status_demo(p,'documented');

 result := public.mwd_owner_partner_location_save_demo(
   p,'Sucursal ficticia CI','Managua','USD',null);
 l := (result->>'id')::uuid;
 IF result->>'real_payouts_enabled'<>'false' THEN
   RAISE EXCEPTION 'Sucursal operativa inesperada';
 END IF;
 SELECT count(*) INTO n FROM public.mwd_owner_partner_locations_demo(p)
 WHERE id=l AND review_status='draft';
 IF n<>1 THEN RAISE EXCEPTION 'No se guardó la sucursal'; END IF;
 SELECT count(*) INTO n FROM public.mwd_owner_partner_audit_demo(p);
 IF n<4 THEN RAISE EXCEPTION 'No se registraron cambios en auditoría'; END IF;
 PERFORM public.mwd_owner_partner_set_status_demo(p,'archived');
 BEGIN
  PERFORM public.mwd_owner_partner_location_save_demo(
    p,'Sucursal prohibida','Managua','USD',null);
  RAISE EXCEPTION 'FALLO: aceptó sucursal para socio archivado';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;

DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM mwd_partners_private.partners;
 IF n<>1 THEN RAISE EXCEPTION 'El registro de prueba no persistió'; END IF;
 SELECT count(*) INTO n FROM mwd_partners_private.locations;
 IF n<>1 THEN RAISE EXCEPTION 'La sucursal de prueba no persistió'; END IF;
 SELECT count(*) INTO n FROM mwd_partners_private.change_audit;
 IF n<4 THEN RAISE EXCEPTION 'Faltan eventos de auditoría'; END IF;
END $$;
SELECT 'Registro de socios demo: RLS, propietario, estados, sucursales y auditoría OK' AS result;
