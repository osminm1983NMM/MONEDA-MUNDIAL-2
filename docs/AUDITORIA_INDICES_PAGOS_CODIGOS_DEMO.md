# Auditoría de índices únicos de pagos y códigos DEMO

Fecha: 2026-11-16. Consulta de solo lectura a pg_index y pg_get_indexdef en Supabase.

## Resultado

Se encontraron 16 índices únicos en cinco tablas:
- payout_assignments: 4 (id, order_id, assignment_request_id, sample_request_id)
- payout_events: 3 (id, request_id, par assignment_id/event_type)
- pickup_code_attempts: 2 (id, par sample_id/request_id)
- pickup_code_events: 1 (id)
- pickup_code_samples: 6 (id, assignment_id, consume_request_id, identity_check_request_id, issue_request_id, token_sha256)

## Protecciones destacadas

- payout_assignments.order_id único: una asignación por orden.
- payout_events (assignment_id,event_type) único: un evento por tipo y asignación.
- pickup_code_samples.assignment_id único: un código de muestra por asignación.
- pickup_code_attempts (sample_id,request_id) único: un registro por referencia de intento en cada código.
- Identificadores de emisión, consumo, comprobación de identidad y cierre tienen índices únicos según su tabla.

## Límites

Los índices no prueban que las funciones apliquen correctamente las transiciones, ni que la concurrencia real se comporte como esperamos. En pickup_code_events solo se verificó clave primaria única, no unicidad por tipo de evento; la consistencia de esos eventos requiere controles de procedimiento y pruebas adicionales. No se realizaron escrituras ni cambios de esquema.

Pendiente: ejecutar en laboratorio aislado las pruebas de reintento, consumo doble, cinco intentos fallidos y cierre doble, y verificar los contadores de eventos.