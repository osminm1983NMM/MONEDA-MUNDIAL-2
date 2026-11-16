-- Verificación de índices únicos y sus columnas en retiros ficticios MWD.
-- SOLO LECTURA: no cambia esquemas, órdenes, permisos ni saldos.
WITH expected(index_name, table_name, expected_columns) AS (
  VALUES
    ('demo_orders_sender_user_id_client_request_id_key', 'demo_orders', '(sender_user_id, client_request_id)'),
    ('demo_orders_pickup_code_sha256_key', 'demo_orders', '(pickup_code_sha256)'),
    ('demo_orders_pkey', 'demo_orders', '(id)'),
    ('demo_order_events_pkey', 'demo_order_events', '(id)')
)
SELECT e.index_name,
       CASE WHEN i.indexdef LIKE '%CREATE UNIQUE INDEX%'
                  AND i.indexdef LIKE '%' || e.expected_columns || '%'
            THEN 'verified' ELSE 'missing_or_changed' END AS audit_result
FROM expected e
LEFT JOIN pg_catalog.pg_indexes i
  ON i.schemaname = 'mwd_pickup_private'
 AND i.tablename = e.table_name
 AND i.indexname = e.index_name
ORDER BY e.index_name;
-- Un resultado 'verified' valida la definición de índice observada,
-- NO demuestra que una transacción de negocio sea completamente atómica.
