-- Verificación de protecciones estructurales de retiros ficticios MWD.
-- Solo lectura. No modifica esquemas, índices, órdenes ni saldos.
WITH expected(index_name, table_name, required_fragment) AS (
  VALUES
    ('demo_orders_sender_user_id_client_request_id_key','demo_orders','UNIQUE INDEX'),
    ('demo_orders_pickup_code_sha256_key','demo_orders','UNIQUE INDEX'),
    ('demo_orders_pkey','demo_orders','UNIQUE INDEX'),
    ('demo_order_events_pkey','demo_order_events','UNIQUE INDEX')
)
SELECT e.index_name,
       CASE WHEN i.indexdef IS NOT NULL
                 AND i.indexdef LIKE '%' || e.required_fragment || '%'
            THEN 'present' ELSE 'missing_or_changed' END AS audit_result
FROM expected e
LEFT JOIN pg_catalog.pg_indexes i
  ON i.schemaname='mwd_pickup_private'
 AND i.tablename=e.table_name
 AND i.indexname=e.index_name
ORDER BY e.index_name;
-- Comprobar además columnas de cada índice antes de concluir que la
-- restricción conserva su semántica; el nombre por sí solo no basta.
