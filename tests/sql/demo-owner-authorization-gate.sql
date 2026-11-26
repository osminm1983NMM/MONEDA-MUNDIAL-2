-- DEMO only: read-only negative authorization tests for every owner RPC.
BEGIN TRANSACTION READ ONLY;
DO $gate$
DECLARE calls text[]; stmt text; identity uuid; ordinary uuid; checked integer:=0;
BEGIN
 SELECT array_agg(format('SELECT public.%I(%s)',p.proname,coalesce((SELECT string_agg('NULL::'||format_type(arg,NULL),', ' ORDER BY ord) FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(arg,ord)),'')) ORDER BY p.proname)
 INTO calls FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'mwd_owner_%' AND has_function_privilege('authenticated',p.oid,'EXECUTE');
 IF coalesce(cardinality(calls),0)<38 THEN RAISE EXCEPTION 'Owner RPC coverage incomplete'; END IF;
 SELECT w.user_id INTO ordinary FROM public.mwd_wallets w WHERE NOT EXISTS(SELECT 1 FROM public.mwd_admin_roles r WHERE r.user_id=w.user_id AND r.role='owner') LIMIT 1;
 IF ordinary IS NULL THEN RAISE EXCEPTION 'Missing non-owner fixture'; END IF;
 FOREACH identity IN ARRAY ARRAY['00000000-0000-4000-8000-000000000001'::uuid,ordinary] LOOP
  PERFORM set_config('request.jwt.claim.sub',identity::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',identity,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  FOREACH stmt IN ARRAY calls LOOP
   BEGIN
    EXECUTE stmt;
    RAISE EXCEPTION 'Owner authorization unexpectedly accepted: %',stmt;
   EXCEPTION WHEN insufficient_privilege THEN checked:=checked+1;
   END;
  END LOOP;
  RESET ROLE;
 END LOOP;
 IF checked<>cardinality(calls)*2 THEN RAISE EXCEPTION 'Owner authorization test incomplete'; END IF;
END $gate$;
SELECT count(*) AS owner_rpc_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'mwd_owner_%' AND has_function_privilege('authenticated',p.oid,'EXECUTE');
ROLLBACK;
