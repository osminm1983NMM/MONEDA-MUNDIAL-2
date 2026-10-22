# Mesa de incidentes de clientes — solo DEMO

Objetivo: registrar de forma idempotente una alegación de cobro duplicado, pago no recibido, devolución no recibida o importe incorrecto, sin presumir que hubo movimientos reales de fondos.

El módulo `createMockCustomerClaimsDesk` admite solamente el motor de pagos ficticios `createMockPaymentLifecycle`. Lee el estado actual y el registro de eventos simulados y propone revisión manual. No ejecuta devoluciones, no modifica saldos, no comprueba bancos y no almacena datos personales. Dos reportes con igual orden y motivo devuelven el mismo caso; reutilizar una `requestId` con un motivo diferente se rechaza.

Cuando hay dos o más eventos `refund_failed_mock`, se presenta `escalate_repeated_refund_failures_mock` como recomendación. **No bloquea por sí mismo los métodos existentes de reintento**, por lo que no debe confundirse con una barrera técnica obligatoria de escalamiento.

Límites: almacenamiento en memoria, auditoría no persistente, sin autenticación de operador y sin validación de evidencia bancaria. Antes de usarlo con dinero real se requiere autorización de acceso, registro durable, investigación del cargo, conciliación con proveedores regulados y verificación del reembolso al medio de pago original.

Ejecutar: `node --test tests/mock-customer-claims-desk.test.mjs` y `npm test`; comprobar CI del PR. No fusionar sin revisión.

## Priorización de revisión
La cola `getMockReviewQueue` ordena primero reclamaciones de cargo duplicado, reembolso con dos o más fallos de simulación y reclamación de pago faltante cuyo estado simulado figura pagado. El resto queda en cola estándar. `getMockQueueSummary` devuelve contadores. Esta es una **clasificación por alegación**, nunca una verificación financiera, SLA real o canal de reclamaciones operativo. La cola se pierde al reiniciar el proceso y no concede facultades de devolución ni bloquea reintentos.

CI: `.github/workflows/test-mock-customer-claims.yml` ejecuta las pruebas pertinentes; confirmar resultados en GitHub Actions antes de aprobar la solicitud de cambios.
