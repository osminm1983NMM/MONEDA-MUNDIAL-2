-- Moneda Mundial 2.0 DEMO: auditoría complementaria SOLO LECTURA.
-- Todas las columnas de errores deben devolver cero.
SELECT
 (SELECT count(*) FROM public.mwd_operations WHERE actor_id IS DISTINCT FROM source_user_id) AS actor_source_mismatch,
 (SELECT count(*) FROM public.mwd_operations WHERE kind='contribution' AND destination_user_id IS NOT NULL) AS contribution_with_destination,
 (SELECT count(*) FROM public.mwd_operations WHERE kind='transfer' AND (destination_user_id IS NULL OR destination_user_id=source_user_id)) AS malformed_transfer,
 (SELECT count(*) FROM mwd_swap_private.demo_journal j LEFT JOIN mwd_swap_private.demo_conversions c ON c.id=j.conversion_id WHERE c.id IS NULL) AS orphan_journal_entries,
 (SELECT count(*) FROM mwd_swap_private.demo_conversions c LEFT JOIN mwd_swap_private.demo_quotes q ON q.id=c.quote_id WHERE q.id IS NULL OR q.status<>'executed') AS conversion_without_executed_quote;
