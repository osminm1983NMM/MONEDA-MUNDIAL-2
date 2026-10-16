# Arquitectura de API de proveedores — contrato de integración sin operar dinero
16 octubre 2026. **Implementación en investigación, sin conexión real.**

## Entrega técnica
- `src/server/provider-integration-port.mjs` define la interfaz de un futuro proveedor regulado mediante cuatro operaciones: cotización no ejecutable, envío ficticio, recepción de notificación firmada de laboratorio y consulta de estado.
- `tests/provider-integration-port.test.mjs` ensaya idempotencia, firma alterada, rechazo de datos bancarios/personales, rutas Honduras/Nicaragua, ausencia de tarifas o tipos de cambio inventados y bloqueo de operaciones reales.
- El adaptador utiliza `src/server/mock-regulated-provider-bridge.mjs`; jamás hace peticiones HTTP, ni usa claves de proveedores reales, ni acredita saldos de clientes.
- La salida `sandbox_completed` se describe como `mock_provider_job_completed_unverified`: **no demuestra dinero fondeado ni pagado**. Sin `ledgerPostingAllowed`, `fundsSettled` o `payoutSettled`.

## Criterios antes de una verdadera integración
1. Entidad legal, cumplimiento KYC/AML/OFAC y contrato para primer corredor Estados Unidos→Honduras (Nicaragua y catálogo mundial siguen en diseño).
2. Credenciales y especificaciones de un sandbox oficial; pruebas bajo identidad del proveedor, secret manager y redes controladas.
3. Estricta correlación de idempotencia por proveedor, orden y evento; validación de remitente y de mensajes, rechazo de repetición, relojes, límites y estados documentados.
4. Confirmación bancaria de **fondeo liquidado** separada de orden aceptada y desembolso concluido, con reconciliación de extractos independientes.
5. Registro duradero ACID de eventos/diarios y recuperación de caída, antifraude y revisión independiente.
6. Proveedor de desembolso efectivo/bancario y acuerdos de agentes pagadores.
7. Módulos futuros de Moneda Mundial Digital y Coin aislados con evaluaciones legales propias.

No se ha contactado a bancos mediante este software, no existe sandbox de tercero activo, tampoco está habilitada ninguna transferencia o emisión de tokens.
