-- PostgreSQL efímero CI, no Supabase real.
INSERT INTO mwd_ledger_research.accounts(code,currency,category) VALUES
 ('BANK_CLEARING_USD','USD','asset'),
 ('CUSTOMER_PAYABLE_USD','USD','liability'),
 ('PAYOUT_PENDING_USD','USD','liability'),
 ('BANK_CLEARING_HNL','HNL','asset'),
 ('CUSTOMER_PAYABLE_HNL','HNL','liability');

DO $$
DECLARE j jsonb;k jsonb;v_id bigint;n bigint;balance bigint;
BEGIN
 j:=mwd_ledger_research.post_mock_journal(
 '11111111-1111-4111-8111-111111111111','bank_event_mock_01','funding_mock_confirmed',
 '[{"account":"BANK_CLEARING_USD","side":"debit","amount_minor":"10000"},{"account":"CUSTOMER_PAYABLE_USD","side":"credit","amount_minor":"10000"}]'::jsonb);
 v_id:=(j->>'journal_id')::bigint;
 k:=mwd_ledger_research.post_mock_journal(
 '11111111-1111-4111-8111-111111111111','bank_event_mock_01','funding_mock_confirmed',
 '[{"account":"BANK_CLEARING_USD","side":"debit","amount_minor":"10000"},{"account":"CUSTOMER_PAYABLE_USD","side":"credit","amount_minor":"10000"}]'::jsonb);
 IF j->>'balanced'<>'true' OR k->>'already_processed'<>'true' OR
    (k->>'journal_id')::bigint<>v_id THEN RAISE EXCEPTION 'Fallo idempotencia'; END IF;
 BEGIN
 PERFORM mwd_ledger_research.post_mock_journal(
 '11111111-1111-4111-8111-111111111111','bank_event_mock_01','funding_mock_confirmed',
 '[{"account":"BANK_CLEARING_USD","side":"debit","amount_minor":"10001"},{"account":"CUSTOMER_PAYABLE_USD","side":"credit","amount_minor":"10001"}]'::jsonb);
 RAISE EXCEPTION 'Aceptó payload distinto en misma clave';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 PERFORM mwd_ledger_research.post_mock_journal(
 '22222222-2222-4222-8222-222222222222','bank_event_mock_02','funding_mock_confirmed',
 '[{"account":"BANK_CLEARING_USD","side":"debit","amount_minor":"10000"},{"account":"CUSTOMER_PAYABLE_USD","side":"credit","amount_minor":"9000"}]'::jsonb);
 RAISE EXCEPTION 'Aceptó asiento desbalanceado';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 PERFORM mwd_ledger_research.post_mock_journal(
 '33333333-3333-4333-8333-333333333333','bank_event_mock_03','funding_mock_confirmed',
 '[{"account":"BANK_CLEARING_USD","side":"debit","amount_minor":"10000"},{"account":"CUSTOMER_PAYABLE_HNL","side":"credit","amount_minor":"10000"}]'::jsonb);
 RAISE EXCEPTION 'Aceptó compensación entre monedas';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 SELECT count(*) INTO n FROM mwd_ledger_research.journals;
 IF n<>1 THEN RAISE EXCEPTION 'Asientos inválidos persistieron'; END IF;
 BEGIN UPDATE mwd_ledger_research.journal_lines SET amount_minor=1 WHERE journal_id=v_id;
 RAISE EXCEPTION 'Permitió modificar una línea';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM mwd_ledger_research.journals WHERE id=v_id;
 RAISE EXCEPTION 'Permitió borrar diario';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 k:=mwd_ledger_research.reconcile_mock_statement(
  '44444444-4444-4444-8444-444444444444','BANK_CLEARING_USD',10000);
 IF k->>'status'<>'matched' OR k->>'source_verified'<>'false' THEN
  RAISE EXCEPTION 'Error conciliación ficticia'; END IF;
 k:=mwd_ledger_research.reconcile_mock_statement(
  '55555555-5555-4555-8555-555555555555','BANK_CLEARING_USD',9900);
 IF k->>'status'<>'discrepancy' OR (k->>'variance_minor')::bigint<>-100 THEN
  RAISE EXCEPTION 'No detectó diferencia de extracto'; END IF;
 BEGIN
 PERFORM mwd_ledger_research.reconcile_mock_statement(
  '55555555-5555-4555-8555-555555555555','BANK_CLEARING_USD',10000);
 RAISE EXCEPTION 'Permitió sustituir reporte';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;

DO $$
BEGIN
 IF has_schema_privilege('authenticated','mwd_ledger_research','USAGE')
 OR has_table_privilege('authenticated','mwd_ledger_research.accounts','SELECT')
 OR has_function_privilege('authenticated',
  'mwd_ledger_research.post_mock_journal(uuid,text,text,jsonb)','EXECUTE')
 OR has_function_privilege('anon',
  'mwd_ledger_research.reconcile_mock_statement(uuid,text,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'Roles cliente pueden acceder al libro mayor'; END IF;
END $$;
SELECT 'Libro mayor DEMO: partida doble, aislamiento, idempotencia, inmutabilidad y conciliación OK' AS result;
