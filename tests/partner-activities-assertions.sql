-- CI exclusivamente aislado: nunca ejecutar sobre Supabase real.
-- Exige fixture, esquema de socios, cumplimiento y seguimiento antes de la agenda.
DO $$ BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='mwd_partners_private.partner_activities'::regclass)
 THEN RAISE EXCEPTION 'RLS de agenda deshabilitada'; END IF;
 IF has_schema_privilege('authenticated','mwd_partners_private','USAGE') OR
 has_table_privilege('authenticated','mwd_partners_private.partner_activities','SELECT') OR
 has_function_privilege('anon','public.mwd_owner_partner_activities_demo(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Agenda expuesta'; END IF;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $$ DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM public.mwd_owner_partner_activities_demo(null);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Usuario regular pudo leer agenda'; END IF;
END $$;
RESET ROLE;
SET request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$
DECLARE p uuid; a uuid; r jsonb; n integer; denied boolean:=false;
BEGIN
 r:=public.mwd_owner_partner_save_demo('Socio imaginario agenda','bank','NI');p:=(r->>'id')::uuid;
 r:=public.mwd_owner_partner_activity_save_demo(p,'meeting_plan','Preparar reunion ficticia',current_date+4);
 a:=(r->>'id')::uuid;
 IF r->>'real_payments_enabled'<>'false' OR r->>'bank_authorized'<>'false' OR
 r->>'notification_sent'<>'false' THEN RAISE EXCEPTION 'Actividad activó servicio real'; END IF;
 SELECT count(*) INTO n FROM public.mwd_owner_partner_activities_demo(p) WHERE id=a;
 IF n<>1 THEN RAISE EXCEPTION 'Actividad no persistió'; END IF;
 PERFORM public.mwd_owner_partner_activity_save_demo(p,'meeting_plan','Reunion completada',
 current_date+4,a,'completed');
 SELECT count(*) INTO n FROM public.mwd_owner_partner_audit_demo(p)
 WHERE entity_type='partner_activities';
 IF n<>2 THEN RAISE EXCEPTION 'Agenda sin auditoría: %',n; END IF;
 BEGIN PERFORM public.mwd_owner_partner_activity_save_demo(p,'meeting_plan','Reintento prohibido',
 current_date+4,a,'completed');
 EXCEPTION WHEN invalid_parameter_value THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Actividad concluida es editable';END IF;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;
SELECT 'Agenda privada simulada, auditoría y bloqueo verificados' AS result;
