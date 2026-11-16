-- Auditoría de solo lectura para Moneda Mundial 2.0 (DEMO).
-- No modifica datos, estados, permisos ni saldos.
SELECT 'duplicate_assignments_per_order' AS check_name, count(*) AS violations
FROM (SELECT order_id FROM mwd_remittance_demo_private.payout_assignments GROUP BY order_id HAVING count(*) > 1) x
UNION ALL
SELECT 'duplicate_completion_events', count(*)
FROM (SELECT assignment_id FROM mwd_remittance_demo_private.payout_events
      WHERE event_type = 'sample_completed' GROUP BY assignment_id HAVING count(*) > 1) x
UNION ALL
SELECT 'completed_without_timestamp_or_key', count(*)
FROM mwd_remittance_demo_private.payout_assignments
WHERE status = 'sample_completed' AND (simulated_at IS NULL OR sample_request_id IS NULL)
UNION ALL
SELECT 'planned_with_completion_fields', count(*)
FROM mwd_remittance_demo_private.payout_assignments
WHERE status = 'planned' AND (simulated_at IS NOT NULL OR sample_request_id IS NOT NULL);
-- Un resultado de cero en todas las filas NO sustituye una prueba de concurrencia real.
