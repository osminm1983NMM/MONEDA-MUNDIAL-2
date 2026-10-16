-- Test de recuperación tras reinicio de CLIENTE psql (Postgres sigue vivo).
-- Fixtures exclusivos. Jamás conectar a Supabase real.
SELECT mwd_inbox_research.register_mock_order(
 'future_regulated_provider_alpha','restart-order-hn-001','HN',10000);
SELECT mwd_inbox_research.record_mock_event(
 'future_regulated_provider_alpha','restart-order-hn-001','restart-event-hn-001',
 'funding_settled_mock',repeat('a',64),'HN',10000);
-- Evento inválido dentro de una transacción: la función aborta y no deja
-- fase ni evento registrado, probado al abrir otra sesión.
DO $$
BEGIN
 BEGIN
  PERFORM mwd_inbox_research.record_mock_event(
    'future_regulated_provider_alpha','restart-order-hn-001','restart-invalid-hn-001',
    'refund_settled_mock',repeat('b',64),'HN',10000);
  RAISE EXCEPTION 'Inesperado: se permitió reembolso sin etapa';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
END $$;
