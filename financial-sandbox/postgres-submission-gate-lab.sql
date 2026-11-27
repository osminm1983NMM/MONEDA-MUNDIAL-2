-- Disposable PostgreSQL laboratory only. Install after dispatch controls and hardening.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
CREATE FUNCTION mwd_financial_lab.check_dispatch_submission(p_ref text,p_token uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,mwd_financial_lab,pg_temp AS $$
 SELECT mwd_financial_lab.check_dispatch_lease(p_ref,p_token) AND EXISTS(
 SELECT FROM mwd_financial_lab.outbox x
 JOIN mwd_financial_lab.reservations z ON z.order_id=x.order_id
 JOIN mwd_financial_lab.quotes q ON q.id=z.quote_id AND q.actor=z.actor
 WHERE x.reference=p_ref AND (x.kind<>'funding' OR q.expires_at>clock_timestamp()));
$$;
REVOKE ALL ON FUNCTION mwd_financial_lab.check_dispatch_submission(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mwd_financial_lab.check_dispatch_submission(text,uuid) TO mwd_lab_dispatch_service;
SET LOCAL ROLE mwd_lab_dispatch_service;
DO $$ BEGIN
 IF mwd_financial_lab.check_dispatch_submission('missing-reference',gen_random_uuid()) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'SUBMISSION_GUARD_NOT_FAIL_CLOSED'; END IF;
END $$;
RESET ROLE;
COMMIT;
