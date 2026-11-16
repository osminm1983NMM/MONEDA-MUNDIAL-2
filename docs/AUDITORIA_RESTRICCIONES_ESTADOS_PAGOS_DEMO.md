# Revisión de integridad referencial y estados DEMO

Fecha: 2026-11-16. Consulta de solo lectura a pg_constraint en Supabase.

## Restricciones verificadas

- payout_assignments: CHECK de estados planned/sample_completed. El estado planned requiere simulated_at y sample_request_id nulos; sample_completed exige ambos presentes. UNIQUE order_id. Claves foráneas hacia orders, partners, locations y auth.users.
- payout_events: UNIQUE (assignment_id,event_type) y request_id, tipo permitido assigned/sample_completed, FK a payout_assignments y auth.users.
- pickup_code_samples: estados active/cancelled/expired/locked/consumed; active exige closed_at nulo, otros estados exigen closed_at no nulo; consumed exige consume_request_id, otros estados exigen NULL; failed_attempts entre 0 y 5; expires_at posterior a created_at; hashes hexadecimales de 64 caracteres; FK a payout_assignments.
- pickup_code_attempts: huella de reintento opcional pero, cuando existe, debe tener 64 caracteres hexadecimales; UNIQUE (sample_id,request_id); FK a pickup_code_samples.
- pickup_code_events: acciones permitidas issued/mock_identity_checked/wrong_code/locked/expired/cancelled/consumed; FK a código y usuario.

## Riesgos pendientes

Las restricciones CHECK garantizan coherencia de columnas en una fila, pero no demuestran que exista un evento correspondiente en otra tabla. La tabla pickup_code_events no tiene una restricción UNIQUE por sample_id y action; los procedimientos y las pruebas concurrentes deben comprobar que no se dupliquen eventos críticos. Tampoco prueban identidad real, desembolso, ni funcionamiento con dinero real.

No se realizaron escrituras ni cambios de permisos, saldos o esquema.