-- REVIEW-ONLY DRAFT: NOT DEPLOYED. MWD fictitious social fund.
-- Must be reviewed in a disposable test database before production deployment.
-- Explicitly approved business designation: fictitious social fund.
BEGIN;
ALTER TABLE mwd_finance_private.ledger_accounts
  DROP CONSTRAINT ledger_accounts_account_type_check;
ALTER TABLE mwd_finance_private.ledger_accounts
  ADD CONSTRAINT ledger_accounts_account_type_check
  CHECK (account_type IN ('customer_liability','provider_clearing','fee_revenue','suspense','social_fund'));
ALTER TABLE mwd_finance_private.ledger_transactions
  DROP CONSTRAINT ledger_transactions_transaction_kind_check;
ALTER TABLE mwd_finance_private.ledger_transactions
  ADD CONSTRAINT ledger_transactions_transaction_kind_check
  CHECK (transaction_kind IN ('deposit','withdrawal','wallet_transfer','direct_transfer','fee','reversal','contribution'));
INSERT INTO mwd_finance_private.ledger_accounts
  (account_code,owner_user_id,currency_code,account_type)
VALUES ('MWD-DEMO-SOCIAL-FUND',NULL,'MWD','social_fund')
ON CONFLICT (account_code) DO NOTHING;

CREATE OR REPLACE FUNCTION mwd_finance_private.post_demo_contribution_ledger_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_tx uuid; v_source uuid; v_fund uuid;
BEGIN
  IF NEW.kind <> 'contribution' THEN RETURN NEW; END IF;
  IF NEW.amount_cents IS NULL OR NEW.amount_cents <= 0
     OR NEW.source_user_id IS NULL OR NEW.destination_user_id IS NOT NULL
     OR NEW.actor_id IS DISTINCT FROM NEW.source_user_id THEN
    RAISE EXCEPTION 'Aportacion DEMO invalida para contabilidad' USING ERRCODE='23514';
  END IF;
  INSERT INTO mwd_finance_private.ledger_accounts
    (account_code,owner_user_id,currency_code,account_type)
  VALUES ('MWD-DEMO-USER-'||NEW.source_user_id::text,NEW.source_user_id,'MWD','customer_liability')
  ON CONFLICT (account_code) DO NOTHING;
  SELECT id INTO v_source FROM mwd_finance_private.ledger_accounts
    WHERE account_code='MWD-DEMO-USER-'||NEW.source_user_id::text
      AND owner_user_id=NEW.source_user_id AND currency_code='MWD'
      AND account_type='customer_liability' FOR UPDATE;
  SELECT id INTO v_fund FROM mwd_finance_private.ledger_accounts
    WHERE account_code='MWD-DEMO-SOCIAL-FUND' AND owner_user_id IS NULL
      AND currency_code='MWD' AND account_type='social_fund' FOR UPDATE;
  IF v_source IS NULL OR v_fund IS NULL THEN
    RAISE EXCEPTION 'Cuenta de aporte ficticio no valida';
  END IF;
  INSERT INTO mwd_finance_private.ledger_transactions
    (external_reference,transaction_kind,currency_code,status)
  VALUES ('mwd-demo-contribution:'||NEW.id::text,'contribution','MWD','draft')
  RETURNING id INTO v_tx;
  INSERT INTO mwd_finance_private.ledger_entries
    (transaction_id,account_id,entry_side,amount_minor)
  VALUES (v_tx,v_source,'debit',NEW.amount_cents),
         (v_tx,v_fund,'credit',NEW.amount_cents);
  UPDATE mwd_finance_private.ledger_transactions
    SET status='posted' WHERE id=v_tx;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION mwd_finance_private.post_demo_contribution_ledger_v1()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS mwd_auto_ledger_contribution_v1 ON public.mwd_operations;
CREATE TRIGGER mwd_auto_ledger_contribution_v1
AFTER INSERT ON public.mwd_operations FOR EACH ROW
EXECUTE FUNCTION mwd_finance_private.post_demo_contribution_ledger_v1();
COMMIT;

-- HISTORICAL BACKFILL NOT INCLUDED. It requires a separate reviewed,
-- idempotent migration and before/after balance and row-count assertions.
