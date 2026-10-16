-- CI sobre PostgreSQL desechable. No usar en producción.
SELECT mwd_inbox_research.register_mock_order(
 'future_regulated_provider_alpha','order-durable-hn-001','HN',10000);
DO $$
DECLARE x jsonb;y jsonb;count_events int;
BEGIN
 x:=mwd_inbox_research.record_mock_event(
 'future_regulated_provider_alpha','order-durable-hn-001','event-funding-hn-001',
 'funding_settled_mock',repeat('a',64),'HN',10000);
 IF x->>'stage'<>'funding_settled_mock' OR x->>'ledger_posted'<>'false'
 THEN RAISE EXCEPTION 'Falla aceptación DEMO';END IF;
 y:=mwd_inbox_research.record_mock_event(
 'future_regulated_provider_alpha','order-durable-hn-001','event-funding-hn-001',
 'funding_settled_mock',repeat('a',64),'HN',10000);
 IF y->>'already_processed'<>'true' THEN RAISE EXCEPTION 'Falla deduplicación'; END IF;
 BEGIN
 PERFORM mwd_inbox_research.record_mock_event(
 'future_regulated_provider_alpha','order-durable-hn-001','event-funding-hn-001',
 'funding_settled_mock',repeat('b',64),'HN',10000);
 RAISE EXCEPTION 'Aceptó replay manipulado';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 PERFORM mwd_inbox_research.record_mock_event(
 'future_regulated_provider_alpha','order-durable-hn-001','event-other-hn-001',
 'refund_settled_mock',repeat('a',64),'HN',10000);
 RAISE EXCEPTION 'Aceptó reembolso sin solicitud';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 PERFORM mwd_inbox_research.record_mock_event(
 'future_regulated_provider_alpha','order-durable-hn-001','event-other-hn-002',
 'payout_pending_mock',repeat('a',64),'NI',10000);
 RAISE EXCEPTION 'Aceptó país cambiado';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 SELECT count(*) INTO count_events FROM mwd_inbox_research.received_events;
 IF count_events<>1 THEN RAISE EXCEPTION 'Eventos incorrectos luego de rechazos';END IF;
 BEGIN
 DELETE FROM mwd_inbox_research.received_events WHERE event_id='event-funding-hn-001';
 RAISE EXCEPTION 'Historial permite borrar';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT mwd_inbox_research.register_mock_order(
 'future_regulated_provider_beta','order-durable-ni-001','NI',10000);
SELECT mwd_inbox_research.record_mock_event(
 'future_regulated_provider_beta','order-durable-ni-001','event-funding-ni-001',
 'funding_pending_mock',repeat('c',64),'NI',10000);
SELECT mwd_inbox_research.record_mock_event(
 'future_regulated_provider_beta','order-durable-ni-001','event-funding-ni-002',
 'funding_settled_mock',repeat('d',64),'NI',10000);
DO $$
BEGIN
 IF has_schema_privilege('authenticated','mwd_inbox_research','USAGE') OR
 has_function_privilege('authenticated',
 'mwd_inbox_research.record_mock_event(text,text,text,text,text,text,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'Acceso anónimo o autenticado no permitido';END IF;
END $$;
SELECT 'Inbox ficticio: deduplicación y transiciones persistentes OK' AS result;
