-- Moneda Mundial 2.0: read-only DEMO accounting release gate.
-- Run as a trusted database operator, never from the mobile client.
BEGIN TRANSACTION READ ONLY;
DO $gate$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mwd_wallets) THEN
    RAISE EXCEPTION 'DEMO gate: no wallet fixtures';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mwd_operations) THEN
    RAISE EXCEPTION 'DEMO gate: no operation fixtures';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mwd_wallets WHERE balance_cents < 0 OR balance_cents IS NULL) THEN
    RAISE EXCEPTION 'DEMO gate: invalid wallet balance';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mwd_operations GROUP BY actor_id, request_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'DEMO gate: duplicate request';
  END IF;
  IF EXISTS (SELECT 1 FROM mwd_finance_private.demo_wallet_alerts_v1 WHERE alert_status IS DISTINCT FROM 'ok') THEN
    RAISE EXCEPTION 'DEMO gate: wallet reconciliation alert';
  END IF;
  IF EXISTS (SELECT 1 FROM mwd_finance_private.demo_ledger_alerts_v1 WHERE alert_status IS DISTINCT FROM 'ok') THEN
    RAISE EXCEPTION 'DEMO gate: ledger reconciliation alert';
  END IF;
END
$gate$;
ROLLBACK;
-- Passing this gate is not proof of concurrency, mobile recovery or production readiness.
