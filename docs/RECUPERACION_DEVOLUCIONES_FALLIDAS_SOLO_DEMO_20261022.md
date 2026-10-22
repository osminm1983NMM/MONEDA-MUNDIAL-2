# Recuperación manual de devoluciones fallidas — SOLO DEMO (22 oct 2026)

## Regla de protección al cliente
Si una devolución simulada queda en `refund_failed_mock`, la orden conserva una situación pendiente de resolución. No debe declararse que el cliente fue reembolsado. Un operador puede solicitar un nuevo intento ficticio **únicamente** con una nueva `requestId` y tras comprobar el estado vigente. Reintentar la misma solicitud es idempotente y no genera otro intento.

## Flujo y estados permitidos
`funded_mock → refund_pending_mock → refund_failed_mock → refund_pending_mock → refunded_mock`.

- **No** se permite reintento si la orden está pagada, cancelada, ya reembolsada, todavía en devolución pendiente o no financiada.
- Cada nuevo intento manual válido deja un evento `refund_retry_requested_mock` en el log de memoria de prueba.
- Un evento firmado idéntico de ensayo se procesa una vez por `eventId`; un identificador reutilizado con distinto contenido se rechaza.
- Ante errores reiterados, escalar a revisión humana; no inferir que el dinero se movió.
- Las propuestas contables siguen siendo **no ejecutables** y nunca se conectan a dinero real.

## Límites de esta versión
Esto es una función en memoria para ensayos unitarios; no implementa un motor persistente de reembolsos, cola real, retenciones contables, SLA, reembolsos bancarios ni notificación a clientes. No se modificó Supabase ni se ejecutaron operaciones financieras. Antes de producción hacen falta conciliación bancaria real, referencias de proveedor, verificación anti duplicación transaccional, control de concurrencia en base de datos y autorización humana auditada.

## Pruebas a ejecutar
`node --test tests/mock-payment-lifecycle.test.mjs` y toda la suite `npm test`. Confirmar también que la prueba CI funciona en la rama de este PR.
