-- Sesión 2: proceso nuevo de PostgreSQL, sin estado de la conexión anterior.
DO $$
DECLARE a jsonb;b jsonb;post_b jsonb;again jsonb;n bigint;
BEGIN
 a:=mwd_recovery_research.inspect_mock_wallet('SIM-US-SEND001');
 b:=mwd_recovery_research.inspect_mock_wallet('SIM-US-SEND002');
 IF (a->>'balance_minor')::bigint<>40000 OR
    (b->>'balance_minor')::bigint<>60000 OR
    (a->>'posted_history_count')::bigint<>1
 THEN RAISE EXCEPTION 'Se perdió el saldo al reiniciar conexión';END IF;

 -- Se confirma B manualmente EN DEMO en esta conexión y se contabiliza.
 PERFORM mwd_recovery_research.verify_mock_receipt(
  'SIM-US-SEND002','checkpoint-ni-request-001',
  '00000000-0000-4000-8000-000000000102');
 post_b:=mwd_recovery_research.post_verified_mock_to_ledger(
  'SIM-US-SEND002','checkpoint-ni-request-001');
 again:=mwd_recovery_research.post_verified_mock_to_ledger(
  'SIM-US-SEND002','checkpoint-ni-request-001');
 IF post_b->>'already_processed'<>'false' OR
    again->>'already_processed'<>'true' OR
    post_b->>'journal_id'<>again->>'journal_id'
 THEN RAISE EXCEPTION 'Se duplicó journal B al reintentar';END IF;

 a:=mwd_recovery_research.inspect_mock_wallet('SIM-US-SEND001');
 b:=mwd_recovery_research.inspect_mock_wallet('SIM-US-SEND002');
 IF (a->>'balance_minor')::bigint<>40000 OR
    (a->>'payout_pending_minor')::bigint<>10000 OR
    (a->>'unverified_requests')::bigint<>1 OR
    (a->>'posted_history_count')::bigint<>1 OR
    a->>'integrity_ok'<>'true' OR
    (b->>'balance_minor')::bigint<>40000 OR
    (b->>'payout_pending_minor')::bigint<>20000 OR
    (b->>'unverified_requests')::bigint<>0 OR
    (b->>'posted_history_count')::bigint<>1 OR
    b->>'integrity_ok'<>'true' OR
    a->>'real_money_enabled'<>'false' OR b->>'bank_verified'<>'false'
 THEN RAISE EXCEPTION 'Saldos/historial A o B distintos del libro mayor';END IF;

 SELECT count(*) INTO n FROM mwd_recovery_research.mock_ledger_links;
 IF n<>2 THEN RAISE EXCEPTION 'Vínculos duplicados o faltantes: %',n;END IF;
 SELECT count(*) INTO n FROM mwd_ledger_research.journals
 WHERE event_type='payout_mock_confirmed';
 IF n<>2 THEN RAISE EXCEPTION 'Asientos de salida duplicados: %',n;END IF;
END $$;
SELECT 'Etapa 139 sesion 2: A 400.00 USD y B 400.00 USD ficticios, historiales conciliados' AS result;
