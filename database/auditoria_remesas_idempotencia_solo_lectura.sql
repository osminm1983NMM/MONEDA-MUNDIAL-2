-- Auditoría de solo lectura: remesas ficticias y reintentos.
-- NO crea órdenes, NO modifica estados, permisos o saldos.
SELECT 'duplicate_transition_request_ids' AS check_name, count(*) AS violations
FROM (
  SELECT order_id, request_id
  FROM mwd_remittance_demo_private.events
  WHERE request_id IS NOT NULL
  GROUP BY order_id, request_id HAVING count(*) > 1
) duplicate_events
UNION ALL
SELECT 'duplicate_simulated_completions', count(*)
FROM (
  SELECT order_id
  FROM mwd_remittance_demo_private.events
  WHERE to_status = 'simulated'
  GROUP BY order_id HAVING count(*) > 1
) duplicate_completions
UNION ALL
SELECT 'duplicate_creation_requests', count(*)
FROM (
  SELECT created_by, request_id
  FROM mwd_remittance_demo_private.orders
  WHERE request_id IS NOT NULL
  GROUP BY created_by, request_id HAVING count(*) > 1
) duplicate_orders;
-- Con cero órdenes, todos los contadores pueden ser cero sin haber probado nada.
-- Ejecutar pruebas activas solo en laboratorio aislado, con datos ficticios.
