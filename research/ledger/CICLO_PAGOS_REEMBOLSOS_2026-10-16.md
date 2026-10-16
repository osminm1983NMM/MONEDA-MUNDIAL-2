# Ciclo de fondeo, desembolso y reembolso — diseño de backend
**16 de octubre de 2026 · MODO INVESTIGACIÓN: SIN DINERO REAL**

Se preparó `src/server/mock-payment-lifecycle.mjs` con estados y notificaciones HMAC totalmente simulados, sin acceso a bancos, Supabase, aplicaciones reales, monedas digitales ni fondos. Las cuentas y el sistema contable de producción siguen pendientes.

## Estados separados
`created_mock` → evento `funding_settled_mock` → `funded_mock` → solicitud de pago → `payout_pending_mock` → `paid_mock`, o `payout_failed_mock` → solicitud de devolución → `refund_pending_mock` → `refunded_mock`.
Las solicitudes de devolución también se permiten directamente desde `funded_mock`, cuando no se ha enviado el desembolso. Los resultados finales son excluyentes. Si un pago se completa, la devolución exige un procedimiento financiero distinto y no puede fingirse como un reverso automático.

## Protección aplicada en laboratorio
- HMAC de ensayo, comprobación de timestamp y de contenido relacionado con la orden; eventos fuera de secuencia, manipulados o duplicados fallan.
- Claves de idempotencia para creación y solicitud de acciones; registro de eventos de laboratorio, sin datos personales.
- Propuestas de asientos en USD a partir de etapas completadas de ensayo. No se contabilizan automáticamente y no constituyen constatación real de dinero recibido o entregado.
- Las confirmaciones ficticias nunca cambian saldos de billetera, ni crean dinero, ni conceden permisos de operación real.
- Honduras y Nicaragua se preservan como escenarios US→HN y US→NI; los demás países siguen disponibles en el catálogo general, sin considerarlos habilitados.

## Qué falta para producción
Una autorización regulatoria y entidad responsable por corredor; contratos con proveedor de financiación y desembolso; acuerdos sobre momento final de liquidación; firmas y orígenes auténticos; consulta de estados por API de proveedor en caso de ambigüedad; KYC/AML/OFAC; libro mayor ACID persistente con colas, locks, doble entrada, conciliación de extractos y reembolsos reales; tasas verificadas y disposiciones fiscales, protección de fondos de clientes y auditoría independiente.

**Advertencia:** las pruebas unitarias de este motor no sustituyen pruebas de concurrencia y recuperación de desastres en una base de datos real. Moneda Mundial Coin y Moneda Mundial Digital siguen siendo módulos de diseño, sin emisión ni conversiones reales.

### Archivos
- `src/server/mock-payment-lifecycle.mjs`
- `tests/mock-payment-lifecycle.test.mjs`
