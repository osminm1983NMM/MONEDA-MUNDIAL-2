-- Tests for the DEMO-only capability handshake, in isolated CI Postgres.
-- The RPC must be callable only by signed-in users, not anonymous callers.
DO $$
BEGIN
  IF has_function_privilege('anon',
    'public.mwd_demo_payout_closure_capability()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous callers must not execute the capability RPC';
  END IF;
  IF NOT has_function_privilege('authenticated',
    'public.mwd_demo_payout_closure_capability()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Signed-in callers must be able to query demo capability';
  END IF;
  IF (SELECT prosecdef FROM pg_proc
      WHERE oid='public.mwd_demo_payout_closure_capability()'::regprocedure) THEN
    RAISE EXCEPTION 'Capability RPC must run with caller privileges';
  END IF;
END $$;

SET ROLE authenticated;
DO $$
BEGIN
  IF public.mwd_demo_payout_closure_capability() IS NOT NULL THEN
    RAISE EXCEPTION 'A missing identity must not receive capability';
  END IF;
END $$;
SET request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $$
DECLARE v jsonb;
BEGIN
  v:=public.mwd_demo_payout_closure_capability();
  IF v IS NULL OR (v->>'version')::int<>1
    OR (v->>'demo_only')::boolean IS DISTINCT FROM true
    OR (v->>'closure_requires_consumed_code')::boolean IS DISTINCT FROM true
    OR (v->>'real_payments_enabled')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Signed-in capability not safe: %',v;
  END IF;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;
SELECT 'Signed-in demo handshake OK, anonymous access denied' AS result;
