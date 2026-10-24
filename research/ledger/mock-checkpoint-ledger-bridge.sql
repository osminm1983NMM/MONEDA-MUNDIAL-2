-- Etapa 139, solo base PostgreSQL ledger_test desechable.
-- Enlaza recibos verificados MANUALMENTE en DEMO con partida doble DEMO.
-- Prohibido desplegar en Supabase real o interpretar como pago bancario.
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'ledger_test' THEN
  RAISE EXCEPTION 'Puente DEMO bloqueado fuera de ledger_test' USING ERRCODE='42501';
 END IF;
END $$;

CREATE TABLE mwd_recovery_research.mock_wallet_accounts (
 actor_alias text PRIMARY KEY CHECK(actor_alias ~ '^SIM-[A-Z]{2}-[A-Z0-9]{3,12}$'),
 payable_account text NOT NULL UNIQUE REFERENCES mwd_ledger_research.accounts(code),
 payout_account text NOT NULL UNIQUE REFERENCES mwd_ledger_research.accounts(code),
 currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 CHECK(payable_account ~ '^CUSTOMER_[A-Z0-9]+_USD$'),
 CHECK(payout_account ~ '^PAYOUT_[A-Z0-9]+_USD$')
);
ALTER TABLE mwd_recovery_research.mock_wallet_accounts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_wallet_mapping
 BEFORE UPDATE OR DELETE ON mwd_recovery_research.mock_wallet_accounts
 FOR EACH ROW EXECUTE FUNCTION mwd_ledger_research.reject_changes();

CREATE TABLE mwd_recovery_research.mock_ledger_links (
 actor_alias text NOT NULL,
 request_id text NOT NULL,
 receipt_order_id uuid NOT NULL UNIQUE,
 journal_id bigint NOT NULL UNIQUE REFERENCES mwd_ledger_research.journals(id),
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(actor_alias,request_id),
 FOREIGN KEY(actor_alias,request_id)
  REFERENCES mwd_recovery_research.requests(actor_alias,request_id)
);
ALTER TABLE mwd_recovery_research.mock_ledger_links ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_checkpoint_links
 BEFORE UPDATE OR DELETE ON mwd_recovery_research.mock_ledger_links
 FOR EACH ROW EXECUTE FUNCTION mwd_ledger_research.reject_changes();

CREATE OR REPLACE FUNCTION mwd_recovery_research.post_verified_mock_to_ledger(
 p_actor text,p_request text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 v_request mwd_recovery_research.requests%rowtype;
 v_map mwd_recovery_research.mock_wallet_accounts%rowtype;
 v_link mwd_recovery_research.mock_ledger_links%rowtype;
 v_balance bigint;
 v_post jsonb;
BEGIN
 -- Dos peticiones simultáneas de una cuenta no pueden revisar el mismo saldo
 -- sin bloquearse. Este mutex de DB no equivale a una cuenta bancaria real.
 SELECT * INTO v_map FROM mwd_recovery_research.mock_wallet_accounts
 WHERE actor_alias=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Actor de laboratorio desconocido' USING ERRCODE='22023';END IF;

 SELECT * INTO v_request FROM mwd_recovery_research.requests
 WHERE actor_alias=p_actor AND request_id=p_request FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud ficticia desconocida' USING ERRCODE='22023';END IF;

 SELECT * INTO v_link FROM mwd_recovery_research.mock_ledger_links
 WHERE actor_alias=p_actor AND request_id=p_request;
 IF FOUND THEN
  IF v_request.status<>'verified_mock' OR
     v_request.receipt_order_id<>v_link.receipt_order_id OR
     v_request.amount_minor<>v_link.amount_minor THEN
   RAISE EXCEPTION 'Vínculo inconsistente' USING ERRCODE='22023';END IF;
  RETURN jsonb_build_object('journal_id',v_link.journal_id,
   'already_processed',true,'mock_only',true,'real_money_enabled',false);
 END IF;
 IF v_request.status<>'verified_mock' OR v_request.receipt_order_id IS NULL THEN
  RAISE EXCEPTION 'Solicitud pendiente: no descontar saldo' USING ERRCODE='22023';
 END IF;

 SELECT coalesce(sum(CASE WHEN side='credit' THEN amount_minor ELSE -amount_minor END),0)::bigint
 INTO v_balance FROM mwd_ledger_research.journal_lines
 WHERE account_code=v_map.payable_account;
 IF v_balance<v_request.amount_minor THEN
  RAISE EXCEPTION 'Saldo ficticio insuficiente: no contabilizar' USING ERRCODE='22023';
 END IF;

 v_post:=mwd_ledger_research.post_mock_journal(
  v_request.receipt_order_id,
  md5(v_request.actor_alias||'|'||v_request.request_id),
  'payout_mock_confirmed',
  jsonb_build_array(
   jsonb_build_object('account',v_map.payable_account,'side','debit',
    'amount_minor',v_request.amount_minor::text),
   jsonb_build_object('account',v_map.payout_account,'side','credit',
    'amount_minor',v_request.amount_minor::text)));

 INSERT INTO mwd_recovery_research.mock_ledger_links(
  actor_alias,request_id,receipt_order_id,journal_id,amount_minor)
 VALUES (p_actor,p_request,v_request.receipt_order_id,
  (v_post->>'journal_id')::bigint,v_request.amount_minor);
 RETURN jsonb_build_object('journal_id',(v_post->>'journal_id')::bigint,
  'already_processed',false,'mock_only',true,'real_money_enabled',false);
END $$;

-- Comparación local de saldos y trazabilidad; no tiene extractos bancarios.
CREATE OR REPLACE FUNCTION mwd_recovery_research.inspect_mock_wallet(
 p_actor text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 v_map mwd_recovery_research.mock_wallet_accounts%rowtype;
 v_available bigint;
 v_payout bigint;
 v_posted bigint;
 v_count bigint;
 v_pending bigint;
 v_broken bigint;
BEGIN
 SELECT * INTO v_map FROM mwd_recovery_research.mock_wallet_accounts
 WHERE actor_alias=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta DEMO desconocida' USING ERRCODE='22023';END IF;
 SELECT coalesce(sum(CASE WHEN side='credit' THEN amount_minor ELSE -amount_minor END),0)::bigint
 INTO v_available FROM mwd_ledger_research.journal_lines WHERE account_code=v_map.payable_account;
 SELECT coalesce(sum(CASE WHEN side='credit' THEN amount_minor ELSE -amount_minor END),0)::bigint
 INTO v_payout FROM mwd_ledger_research.journal_lines WHERE account_code=v_map.payout_account;
 SELECT coalesce(sum(amount_minor),0)::bigint,count(*)
 INTO v_posted,v_count FROM mwd_recovery_research.mock_ledger_links
 WHERE actor_alias=p_actor;
 SELECT count(*) INTO v_pending FROM mwd_recovery_research.requests
 WHERE actor_alias=p_actor AND status='pending_verification_mock';

 -- Cada recibo contabilizado debe tener exactamente dos líneas correctas
 -- en USD, el valor original y el journal del recibo correspondiente.
 SELECT count(*) INTO v_broken
 FROM mwd_recovery_research.mock_ledger_links l
 JOIN mwd_recovery_research.requests r
  ON (r.actor_alias=l.actor_alias AND r.request_id=l.request_id)
 JOIN mwd_ledger_research.journals j ON j.id=l.journal_id
 WHERE l.actor_alias=p_actor AND (
  r.status<>'verified_mock' OR r.receipt_order_id<>l.receipt_order_id OR
  l.amount_minor<>r.amount_minor OR j.request_key<>l.receipt_order_id OR
  j.event_type<>'payout_mock_confirmed' OR
  (SELECT count(*) FROM mwd_ledger_research.journal_lines x
   WHERE x.journal_id=l.journal_id)<>2 OR
  (SELECT count(*) FROM mwd_ledger_research.journal_lines x
   WHERE x.journal_id=l.journal_id AND x.currency='USD' AND
    x.amount_minor=l.amount_minor AND
    ((x.account_code=v_map.payable_account AND x.side='debit') OR
     (x.account_code=v_map.payout_account AND x.side='credit')))<>2);

 RETURN jsonb_build_object('actor_alias',p_actor,
  'balance_minor',v_available,'payout_pending_minor',v_payout,
  'posted_total_minor',v_posted,'posted_history_count',v_count,
  'unverified_requests',v_pending,
  'integrity_ok',v_broken=0 AND v_payout=v_posted AND v_available>=0,
  'bank_verified',false,'safe_to_submit_again',false,
  'real_money_enabled',false,'mock_only',true);
END $$;

REVOKE ALL ON mwd_recovery_research.mock_wallet_accounts,
 mwd_recovery_research.mock_ledger_links FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION mwd_recovery_research.post_verified_mock_to_ledger(text,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION mwd_recovery_research.inspect_mock_wallet(text)
 FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE mwd_recovery_research.mock_ledger_links IS
 'Solo investigación local: recibos manuales, sin dinero ni validación de proveedor';
COMMIT;
