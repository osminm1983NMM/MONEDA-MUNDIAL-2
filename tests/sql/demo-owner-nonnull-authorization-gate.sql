-- DEMO: negative owner authorization with non-null typed input; no writes.
BEGIN TRANSACTION READ ONLY;
DO $gate$
DECLARE rec record; calls text[]; stmt text; identity uuid; ordinary uuid; checked integer:=0; n integer;
BEGIN
 SELECT array_agg(format('SELECT public.%I(%s)',p.proname,coalesce((
 SELECT string_agg(CASE format_type(a.arg,NULL)
 WHEN 'uuid' THEN '''00000000-0000-4000-8000-000000000099''::uuid'
 WHEN 'text' THEN '''HN''::text'
 WHEN 'integer' THEN '30::integer'
 WHEN 'bigint' THEN '1000::bigint'
 WHEN 'numeric' THEN '0.125::numeric'
 WHEN 'boolean' THEN 'true::boolean'
 WHEN 'date' THEN '''2027-01-01''::date'
 WHEN 'timestamp with time zone' THEN '''2026-11-26T00:00:00Z''::timestamptz'
 ELSE 'NULL::'||format_type(a.arg,NULL) END,', ' ORDER BY a.ord)
 FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY a(arg,ord)),'')) ORDER BY p.proname)
 INTO calls FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid=p.pronamespace
 WHERE nsp.nspname='public' AND p.proname LIKE 'mwd_owner_%' AND has_function_privilege('authenticated',p.oid,'EXECUTE');
 n:=coalesce(cardinality(calls),0);
 IF n<38 THEN RAISE EXCEPTION 'Owner RPC coverage incomplete: %',n; END IF;
 IF EXISTS (SELECT 1 FROM unnest(calls) c WHERE c LIKE '%NULL::%') THEN RAISE EXCEPTION 'Unhandled argument type'; END IF;
 SELECT w.user_id INTO ordinary FROM public.mwd_wallets w
 WHERE NOT EXISTS(SELECT 1 FROM public.mwd_admin_roles r WHERE r.user_id=w.user_id AND r.role='owner') ORDER BY w.user_id LIMIT 1;
 IF ordinary IS NULL THEN RAISE EXCEPTION 'Missing ordinary fixture'; END IF;
 FOREACH identity IN ARRAY ARRAY['00000000-0000-4000-8000-000000000001'::uuid,ordinary] LOOP
  PERFORM set_config('request.jwt.claim.sub',identity::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',identity,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  FOREACH stmt IN ARRAY calls LOOP
   BEGIN
    EXECUTE stmt;
    RAISE EXCEPTION 'Owner RPC accepted unauthorized call: %',stmt;
   EXCEPTION WHEN insufficient_privilege THEN checked:=checked+1;
   END;
  END LOOP;
  RESET ROLE;
 END LOOP;
 IF checked<>n*2 THEN RAISE EXCEPTION 'Incomplete owner coverage'; END IF;
END $gate$;
SELECT count(*) AS owner_rpcs, count(*)*2 AS rejected_calls
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'mwd_owner_%' AND has_function_privilege('authenticated',p.oid,'EXECUTE');
ROLLBACK;
