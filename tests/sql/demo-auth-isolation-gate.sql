-- Simulated authenticated identity without a wallet; read-only isolation check.
BEGIN TRANSACTION READ ONLY;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $gate$
BEGIN
 IF EXISTS (SELECT 1 FROM public.mwd_wallets) THEN RAISE EXCEPTION 'Unexpected wallet access'; END IF;
 IF EXISTS (SELECT 1 FROM public.mwd_operations) THEN RAISE EXCEPTION 'Unexpected operation access'; END IF;
 IF EXISTS (SELECT 1 FROM public.mwd_admin_roles) THEN RAISE EXCEPTION 'Unexpected role access'; END IF;
 BEGIN
  PERFORM public.mwd_owner_summary_demo();
  RAISE EXCEPTION 'Unexpected owner access';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF public.mwd_operation_status_demo('00000000-0000-4000-8000-000000000002'::uuid)->>'status' IS DISTINCT FROM 'unconfirmed' THEN RAISE EXCEPTION 'Unexpected recovery status'; END IF;
END $gate$;
ROLLBACK;
