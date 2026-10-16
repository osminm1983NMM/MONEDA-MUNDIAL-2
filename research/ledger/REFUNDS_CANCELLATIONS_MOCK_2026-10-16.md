# Cancelaciones y devoluciones internacionales — laboratorio MWD

**NO hay transferencias, dinero, socios, saldos, tarjetas ni reembolsos reales.**

En el motor local `createMockPaymentLifecycle` se añade
`cancelMockBeforeFunding({orderId,requestId})`. Solo es admisible desde
`created_mock`, antes de cualquier evento de fondeo. Utiliza la misma
idempotencia que el motor ficticio; una segunda solicitud con otra clave
se rechaza. Una notificación posterior de fondeo se rechaza porque el
estado `cancelled_mock` es terminal.

Una orden en `funded_mock` o `payout_failed_mock` puede invocar el
método EXISTENTE `requestMockRefund`; esto únicamente la coloca en
`refund_pending_mock`, no implica devolver fondos.

Una salida `payout_pending_mock` NO se cancela o reembolsa hasta
recibir una respuesta de proveedor válida que resuelva su estado.
Las órdenes `paid_mock`, `refunded_mock` o `cancelled_mock`
son terminales y no crean segundas devoluciones.

El conciliador comprende `cancelled_mock` como cierre sin fondos ni
extractos. Si aparecen registros inesperados después de cancelar, exige
revisión manual. El panel administrativo incluido es deliberadamente
**solo una guía de casos inventados**, sin RPC ni operaciones.

Antes de usar dinero real harán falta controles de autorización, plazos
y derechos de cancelación por jurisdicción, pruebas de retorno bancario,
asientos contables verificables, proveedor autorizado, soporte,
reclamaciones y garantías de protección al cliente. Este diseño no
pretende resolver esos requisitos.
