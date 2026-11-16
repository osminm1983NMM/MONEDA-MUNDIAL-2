\set ON_ERROR_STOP on
-- PostgreSQL efimero: modelo del control de propietario observado en Supabase.
-- No conecta ni escribe en Supabase principal.
CREATE TABLE public.mwd_admin_roles(user_id uuid PRIMARY KEY,role text NOT NULL);
INSERT INTO public.mwd_admin_roles(user_id,role) VALUES ('00000000-0000-0000-0000-000000000041','owner');
CREATE OR REPLACE FUNCTION public.test_owner_only_demo() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.mwd_admin_roles WHERE user_id=auth.uid() AND role='owner'
 ) THEN RAISE EXCEPTION 'Acceso denegado' USING errcode='42501'; END IF;
 RETURN 'authorized';
END $$;
DO $$ DECLARE identity text; BEGIN
 FOREACH identity IN ARRAY ARRAY['','00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000042'] LOOP
  PERFORM set_config('request.jwt.claim.sub',identity,false);
  BEGIN
   PERFORM public.test_owner_only_demo();
   RAISE EXCEPTION 'unauthorized actor accepted: %',identity;
  EXCEPTION WHEN insufficient_privilege THEN
   IF SQLERRM <> 'Acceso denegado' THEN RAISE; END IF;
  END;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000041',false);
 IF public.test_owner_only_demo()<>'authorized' THEN RAISE EXCEPTION 'owner rejected'; END IF;
END $$;
-- Comprueba que el rol de usuario no permita elevar privilegios por SQL directo.
REVOKE ALL ON public.mwd_admin_roles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.mwd_admin_roles TO authenticated;
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.mwd_admin_roles','INSERT') OR
    has_table_privilege('authenticated','public.mwd_admin_roles','UPDATE') OR
    has_table_privilege('authenticated','public.mwd_admin_roles','DELETE') THEN
   RAISE EXCEPTION 'authenticated can modify admin roles';
 END IF;
END $$;
DROP FUNCTION public.test_owner_only_demo();
DROP TABLE public.mwd_admin_roles;
SELECT 'POSTGRES_OWNER_NEGATIVE_ACCESS_PASS' AS result;
