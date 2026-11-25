BEGIN TRANSACTION READ ONLY;
DO $gate$
DECLARE a uuid; b uuid; expected bigint;
BEGIN
 SELECT user_id INTO a FROM public.mwd_wallets ORDER BY user_id LIMIT 1;
 SELECT user_id INTO b FROM public.mwd_wallets WHERE user_id<>a ORDER BY user_id LIMIT 1;
 IF a IS NULL OR b IS NULL THEN RAISE EXCEPTION 'Two wallets required'; END IF;
 SELECT count(*) INTO expected FROM public.mwd_operations WHERE source_user_id=a OR destination_user_id=a;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 IF (SELECT count(*) FROM public.mwd_wallets)<>1 OR EXISTS(SELECT 1 FROM public.mwd_wallets WHERE user_id=b) THEN RAISE EXCEPTION 'Wallet isolation failure'; END IF;
 IF (SELECT count(*) FROM public.mwd_operations)<>expected THEN RAISE EXCEPTION 'History isolation failure'; END IF;
 IF EXISTS(SELECT 1 FROM public.mwd_operations WHERE source_user_id IS DISTINCT FROM a AND destination_user_id IS DISTINCT FROM a) THEN RAISE EXCEPTION 'Foreign operation visible'; END IF;
 RESET ROLE;
END $gate$;
ROLLBACK;
