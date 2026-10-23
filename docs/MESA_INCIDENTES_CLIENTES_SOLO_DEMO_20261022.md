# Mesa de incidentes de clientes — solo DEMO

Objetivo: registrar de forma idempotente una alegación de cobro duplicado, pago no recibido, devolución no recibida o importe incorrecto, sin presumir que hubo movimientos reales de fondos.

El módulo `createMockCustomerClaimsDesk` admite solamente el motor de pagos ficticios `createMockPaymentLifecycle`. Lee el estado actual y el registro de eventos simulados y propone revisión manual. No ejecuta devoluciones, no modifica saldos, no comprueba bancos y no almacena datos personales. Dos reportes con igual orden y motivo devuelven el mismo caso; reutilizar una `requestId` con un motivo diferente se rechaza.

Cuando hay dos o más eventos `refund_failed_mock`, la mesa recomienda escalar el caso y el motor de simulación **bloquea el tercer intento nuevo** de `retryMockRefundAfterFailure`, incluso si todavía no hay reclamación abierta. `inspectMockRefundSafetyHold(orderId)` permite consultar el bloqueo sin cambiar estados. Reutilizar la `requestId` antigua sólo devuelve la respuesta histórica, sin ejecutar otra operación. **No hay anulación automática ni bypass:** se requiere desarrollar por separado el proceso de investigación manual.

Límites: almacenamiento en memoria, auditoría no persistente, sin autenticación de operador y sin validación de evidencia bancaria. Antes de usarlo con dinero real se requiere autorización de acceso, registro durable, investigación del cargo, conciliación con proveedores regulados y verificación del reembolso al medio de pago original.

Ejecutar: `node --test tests/mock-customer-claims-desk.test.mjs` y `npm test`; comprobar CI del PR. No fusionar sin revisión.

## Priorización de revisión
La cola `getMockReviewQueue` ordena primero reclamaciones de cargo duplicado, reembolso con dos o más fallos de simulación y reclamación de pago faltante cuyo estado simulado figura pagado. El resto queda en cola estándar. `getMockQueueSummary` devuelve contadores. Esta es una **clasificación por alegación**, nunca una verificación financiera, SLA real o canal de reclamaciones operativo. La cola se pierde al reiniciar el proceso y no concede facultades de devolución. El bloqueo del motor es también volátil y no es un control apto para producción.

CI: `.github/workflows/test-mock-customer-claims.yml` ejecuta las pruebas pertinentes; confirmar resultados en GitHub Actions antes de aprobar la solicitud de cambios.
