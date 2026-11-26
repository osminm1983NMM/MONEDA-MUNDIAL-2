-- DEMO only: exercise retry paths of already-settled operations, never first submissions.
BEGIN;
SET LOCAL lock_timeout='2s';
DO $gate$
DECLARE o record; j jsonb; before_wallets jsonb; after_wallets jsonb; n bigint; checked int:=0; wrong bigint;
BEGIN
 SELECT jsonb_object_agg(user_id,balance_cents) INTO before_wallets FROM public.mwd_wallets;
 SELECT count(*) INTO n FROM public.mwd_operations;
 FOR o IN SELECT op.*,w.account_code FROM public.mwd_operations op LEFT JOIN public.mwd_wallets w ON w.user_id=op.destination_user_id WHERE op.kind IN ('transfer','contribution') AND op.source_user_id=op.actor_id LOOP
  PERFORM set_config('request.jwt.claim.sub',o.actor_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',o.actor_id,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  IF o.kind='transfer' THEN
   j:=public.mwd_transfer_demo(o.account_code,o.amount_cents,o.request_id);
  ELSE
   j:=public.mwd_contribute_demo(o.amount_cents,o.request_id);
  END IF;
  IF j->>'status' IS DISTINCT FROM 'already_processed' OR j->>'operation_id' IS DISTINCT FROM o.id::text THEN RAISE EXCEPTION 'Historical retry mismatch'; END IF;
  wrong:=CASE WHEN o.amount_cents<100000000 THEN o.amount_cents+1 ELSE o.amount_cents-1 END;
  BEGIN
   IF o.kind='transfer' THEN
    PERFORM public.mwd_transfer_demo(o.account_code,wrong,o.request_id);
   ELSE
    PERFORM public.mwd_contribute_demo(wrong,o.request_id);
   END IF;
   RAISE EXCEPTION 'Conflicting retry accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM IS DISTINCT FROM 'Identificador ya usado para otra operacion' THEN RAISE; END IF;
  END;
  RESET ROLE;
  checked:=checked+1;
 END LOOP;
 SELECT jsonb_object_agg(user_id,balance_cents) INTO after_wallets FROM public.mwd_wallets;
 IF checked=0 OR before_wallets IS DISTINCT FROM after_wallets OR n<>(SELECT count(*) FROM public.mwd_operations) THEN RAISE EXCEPTION 'Retry altered wallet balances or operation count'; END IF;
END $gate$;
SELECT kind,count(*) AS checked FROM public.mwd_operations WHERE kind IN ('transfer','contribution') AND source_user_id=actor_id GROUP BY kind;
ROLLBACK;
