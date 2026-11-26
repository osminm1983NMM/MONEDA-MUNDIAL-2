-- DEMO only: read-only historical operation recovery and cross-account privacy.
BEGIN TRANSACTION READ ONLY;
DO $gate$
DECLARE a uuid; ref uuid; oid uuid; k text; amount bigint; code text; foreign_actor uuid; j jsonb; expected uuid[]; checked integer:=0; blocked integer:=0; op record;
BEGIN
 FOR op IN SELECT o.actor_id,o.request_id,o.id,o.kind,o.amount_cents,w.account_code FROM public.mwd_operations o LEFT JOIN public.mwd_wallets w ON w.user_id=o.destination_user_id WHERE o.kind IN ('transfer','contribution') AND o.source_user_id=o.actor_id LOOP
  a:=op.actor_id; ref:=op.request_id; oid:=op.id; k:=op.kind; amount:=op.amount_cents; code:=op.account_code;
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  j:=public.mwd_operation_status_demo(ref);
  IF j->>'status' IS DISTINCT FROM 'processed' OR j->>'operationId' IS DISTINCT FROM oid::text OR j->>'kind' IS DISTINCT FROM k OR (j->>'amountCents')::bigint IS DISTINCT FROM amount OR j->>'realPaymentsEnabled' IS DISTINCT FROM 'false' OR (k='transfer' AND j->>'recipientCode' IS DISTINCT FROM code) THEN RAISE EXCEPTION 'Own operation recovery mismatch'; END IF;
  RESET ROLE;
  checked:=checked+1;
  SELECT w.user_id INTO foreign_actor FROM public.mwd_wallets w WHERE w.user_id<>a AND NOT EXISTS(SELECT 1 FROM public.mwd_operations o WHERE o.actor_id=w.user_id AND o.request_id=ref) ORDER BY w.user_id LIMIT 1;
  IF foreign_actor IS NULL THEN RAISE EXCEPTION 'Missing cross-account fixture'; END IF;
  PERFORM set_config('request.jwt.claim.sub',foreign_actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',foreign_actor,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  j:=public.mwd_operation_status_demo(ref);
  IF j->>'status' IS DISTINCT FROM 'unconfirmed' OR j ? 'operationId' OR j ? 'amountCents' OR j ? 'recipientCode' THEN RAISE EXCEPTION 'Foreign operation leaked'; END IF;
  RESET ROLE;
  blocked:=blocked+1;
 END LOOP;
 IF checked=0 OR blocked<>checked THEN RAISE EXCEPTION 'Recovery coverage incomplete'; END IF;
 FOR a IN SELECT user_id FROM public.mwd_wallets LOOP
  SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO expected FROM (SELECT id FROM public.mwd_operations WHERE source_user_id=a OR destination_user_id=a ORDER BY created_at DESC LIMIT 50) h;
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  j:=public.mwd_history_demo();
  IF jsonb_array_length(j)<>cardinality(expected) OR EXISTS(SELECT 1 FROM jsonb_array_elements(j) x WHERE NOT coalesce((x->>'id')::uuid=ANY(expected),false)) OR (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(j) x)<>cardinality(expected) THEN RAISE EXCEPTION 'History coverage or privacy mismatch'; END IF;
  RESET ROLE;
 END LOOP;
END $gate$;
SELECT count(*) FILTER (WHERE kind IN ('transfer','contribution') AND source_user_id=actor_id) AS recoverable_operations,(SELECT count(*) FROM public.mwd_wallets) AS wallets_checked FROM public.mwd_operations;
ROLLBACK;
