-- Sesión psql NUEVA (recuperación): persistencia sin doble abono.
DO $$
DECLARE v_stage text; v_count int; v_repeat jsonb;
BEGIN
 SELECT stage INTO v_stage FROM mwd_inbox_research.orders
 WHERE provider_id='future_regulated_provider_alpha' AND order_id='restart-order-hn-001';
 IF v_stage<>'funding_settled_mock' THEN
 RAISE EXCEPTION 'Tras reiniciar sesión no se recuperó estado';END IF;
 SELECT count(*) INTO v_count FROM mwd_inbox_research.received_events
 WHERE provider_id='future_regulated_provider_alpha' AND order_id='restart-order-hn-001';
 IF v_count<>1 THEN RAISE EXCEPTION 'Evento perdido o duplicado tras reinicio';END IF;
 v_repeat:=mwd_inbox_research.record_mock_event(
 'future_regulated_provider_alpha','restart-order-hn-001','restart-event-hn-001',
 'funding_settled_mock',repeat('a',64),'HN',10000);
 IF v_repeat->>'already_processed'<>'true' THEN RAISE EXCEPTION 'Reintento creó otra operación';END IF;
 BEGIN
 PERFORM mwd_inbox_research.record_mock_event(
 'future_regulated_provider_alpha','restart-order-hn-001','restart-event-hn-001',
 'funding_settled_mock',repeat('c',64),'HN',10000);
 RAISE EXCEPTION 'Reenvío manipulado aceptado';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 SELECT count(*) INTO v_count FROM mwd_inbox_research.received_events
 WHERE provider_id='future_regulated_provider_alpha' AND order_id='restart-order-hn-001';
 IF v_count<>1 THEN RAISE EXCEPTION 'Invariante de deduplicación violada';END IF;
END $$;
SELECT 'RECUPERACIÓN DEMO: nuevo cliente, estado duradero y reintentos OK' AS result;
