-- Disposable PostgreSQL only: read-only status contract for the trusted order service.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=pg_catalog,mwd_financial_lab,pg_temp;
-- Actor must be derived by the future authenticated service, never from an
-- end-user parameter. No access to unreserved legacy orders or internal refs.
CREATE FUNCTION mwd_financial_lab.read_order_status(p_actor text,p_order uuid)
RETURNS TABLE(order_id uuid,status text,principal_minor bigint,fee_minor bigint,total_minor bigint,
 source_currency text,payout_minor bigint,payout_currency text,accepted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,mwd_financial_lab,pg_temp
AS $$
 SELECT o.id,o.state,o.amount_cents,o.fee_cents,r.total_cents,
        'USD'::text,o.payout_minor,'HNL'::text,r.accepted_at
 FROM mwd_financial_lab.orders o
 JOIN mwd_financial_lab.reservations r ON r.order_id=o.id AND r.actor=o.actor
 WHERE o.id=p_order AND o.actor=p_actor
$$;
REVOKE ALL ON FUNCTION mwd_financial_lab.read_order_status(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mwd_financial_lab.read_order_status(text,uuid) TO mwd_lab_order_service;
COMMIT;
