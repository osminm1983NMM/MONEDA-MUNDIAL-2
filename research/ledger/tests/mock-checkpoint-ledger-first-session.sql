-- Sesión 1, PostgreSQL efímero. Dos billeteras SIMULADAS con USD ficticios.
INSERT INTO mwd_ledger_research.accounts(code,currency,category) VALUES
 ('DEMO_FLOAT_USD','USD','asset'),
 ('CUSTOMER_A_USD','USD','liability'),('PAYOUT_A_USD','USD','liability'),
 ('CUSTOMER_B_USD','USD','liability'),('PAYOUT_B_USD','USD','liability'),
 ('CUSTOMER_C_USD','USD','liability'),('PAYOUT_C_USD','USD','liability');
INSERT INTO mwd_recovery_research.mock_wallet_accounts
 (actor_alias,payable_account,payout_account) VALUES
 ('SIM-US-SEND001','CUSTOMER_A_USD','PAYOUT_A_USD'),
 ('SIM-US-SEND002','CUSTOMER_B_USD','PAYOUT_B_USD'),
 ('SIM-US-SEND003','CUSTOMER_C_USD','PAYOUT_C_USD');

DO $$
DECLARE first_post jsonb;again jsonb;a jsonb;b jsonb;counts bigint;
BEGIN
 -- Se entrega crédito ficticio mediante partida doble, nunca a banco alguno.
 PERFORM mwd_ledger_research.post_mock_journal(
  '10000000-0000-4000-8000-000000000001','fixture_funding_a_mock',
  'funding_mock_confirmed',
  '[{"account":"DEMO_FLOAT_USD","side":"debit","amount_minor":"50000"},
    {"account":"CUSTOMER_A_USD","side":"credit","amount_minor":"50000"}]'::jsonb);
 PERFORM mwd_ledger_research.post_mock_journal(
  '10000000-0000-4000-8000-000000000002','fixture_funding_b_mock',
  'funding_mock_confirmed',
  '[{"account":"DEMO_FLOAT_USD","side":"debit","amount_minor":"60000"},
    {"account":"CUSTOMER_B_USD","side":"credit","amount_minor":"60000"}]'::jsonb);

 a:=mwd_recovery_research.inspect_mock_wallet('SIM-US-SEND001');
 b:=mwd_recovery_research.inspect_mock_wallet('SIM-US-SEND002');
 IF (a->>'balance_minor')::bigint<>50000 OR
    (b->>'balance_minor')::bigint<>60000 OR
    (a->>'posted_history_count')::bigint<>0 OR
    (b->>'posted_history_count')::bigint<>0
 THEN RAISE EXCEPTION 'El saldo inicial DEMO no concilia';END IF;

 -- Solo A tiene recibo verificado manualmente en etapa 138.
 first_post:=mwd_recovery_research.post_verified_mock_to_ledger(
   'SIM-US-SEND001','checkpoint-hn-request-001');
 again:=mwd_recovery_research.post_verified_mock_to_ledger(
   'SIM-US-SEND001','checkpoint-hn-request-001');
 IF first_post->>'already_processed'<>'false' OR
    again->>'already_processed'<>'true' OR
    first_post->>'journal_id'<>again->>'journal_id'
 THEN RAISE EXCEPTION 'La publicación duplicó el asiento';END IF;

 BEGIN
  PERFORM mwd_recovery_research.post_verified_mock_to_ledger(
   'SIM-US-SEND002','checkpoint-ni-request-001');
  RAISE EXCEPTION 'Se descontó operación de B todavía pendiente';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 BEGIN
  PERFORM mwd_recovery_research.post_verified_mock_to_ledger(
   'SIM-US-SEND001','checkpoint-hn-request-002');
  RAISE EXCEPTION 'Se descontó segunda operación A sin verificar';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;END;

 a:=mwd_recovery_research.inspect_mock_wallet('SIM-US-SEND001');
 b:=mwd_recovery_research.inspect_mock_wallet('SIM-US-SEND002');
 IF (a->>'balance_minor')::bigint<>40000 OR
    (a->>'payout_pending_minor')::bigint<>10000 OR
    (a->>'posted_history_count')::bigint<>1 OR
    (a->>'unverified_requests')::bigint<>1 OR
    a->>'integrity_ok'<>'true' OR
    (b->>'balance_minor')::bigint<>60000 OR
    (b->>'posted_history_count')::bigint<>0 OR
    b->>'integrity_ok'<>'true'
 THEN RAISE EXCEPTION 'Historial y saldos de A/B no coinciden';END IF;

 -- Cuenta C sin fondeo: el recibo ficticio NO autoriza saldo negativo.
 PERFORM mwd_recovery_research.reserve_mock_request(
  'SIM-US-SEND003','checkpoint-hn-request-003',
  '00000000-0000-4000-8000-000000000004','SIM-HN-RECIP01','HN',10000);
 PERFORM mwd_recovery_research.verify_mock_receipt(
  'SIM-US-SEND003','checkpoint-hn-request-003',
  '00000000-0000-4000-8000-000000000103');
 BEGIN
  PERFORM mwd_recovery_research.post_verified_mock_to_ledger(
   'SIM-US-SEND003','checkpoint-hn-request-003');
  RAISE EXCEPTION 'Aceptó saldo negativo en C';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 SELECT count(*) INTO counts FROM mwd_recovery_research.mock_ledger_links;
 IF counts<>1 THEN RAISE EXCEPTION 'Se insertó un asiento prohibido';END IF;

 BEGIN
  DELETE FROM mwd_recovery_research.mock_ledger_links WHERE actor_alias='SIM-US-SEND001';
  RAISE EXCEPTION 'Se pudo borrar historial vinculado';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF has_table_privilege('anon','mwd_recovery_research.mock_ledger_links','SELECT') OR
    has_function_privilege('authenticated',
      'mwd_recovery_research.post_verified_mock_to_ledger(text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Se expuso el puente al móvil';END IF;
END $$;
SELECT 'Etapa 139 sesion 1: A contabilizada una vez, B pendiente, C sin saldo protegida' AS result;
