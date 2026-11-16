-- Auditoría de solo lectura: órdenes de retiro ficticio MWD (Supabase).
-- Ejecutar como administrador técnico en SQL Editor; NO usa credenciales del móvil.
-- No cambia datos, permisos ni saldos.
-- Las órdenes de este módulo son registros de simulación; no representan dinero real.
WITH cancel_counts AS (
  SELECT o.id, o.status,
         count(e.id) FILTER (WHERE e.event_kind = 'cancelled') AS cancellation_events
  FROM mwd_pickup_private.demo_orders o
  LEFT JOIN mwd_pickup_private.demo_order_events e ON e.order_id = o.id
  GROUP BY o.id, o.status
)
SELECT 'cancelled_without_exactly_one_event' AS check_name, count(*) AS violations
FROM cancel_counts WHERE status = 'cancelled' AND cancellation_events <> 1
UNION ALL
SELECT 'noncancelled_with_cancel_event', count(*)
FROM cancel_counts WHERE status <> 'cancelled' AND cancellation_events > 0
UNION ALL
SELECT 'duplicate_request_ids_per_sender', count(*)
FROM (
  SELECT sender_user_id, client_request_id
  FROM mwd_pickup_private.demo_orders
  WHERE client_request_id IS NOT NULL
  GROUP BY sender_user_id, client_request_id HAVING count(*) > 1
) duplicates
UNION ALL
SELECT 'invalid_amount_cents', count(*)
FROM mwd_pickup_private.demo_orders WHERE amount_cents IS NULL OR amount_cents <= 0
UNION ALL
SELECT 'expiration_not_after_creation', count(*)
FROM mwd_pickup_private.demo_orders WHERE expires_at <= created_at;

-- Resultado cero significa que no se detectaron estas anomalías en los datos
-- existentes; NO prueba aislamiento de transacciones, RLS ni concurrencia.
