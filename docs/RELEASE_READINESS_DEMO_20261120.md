# Moneda Mundial 2.0 — puertas de salida (DEMO)

Estado: **NO APROBADO para dinero real**. Esta lista no equivale a resultados de pruebas. La rama principal no se modifica.

## Comprobaciones automatizables sin infraestructura de pago

- [x] Ejecutar las comprobaciones estáticas en CI y guardar el resultado.
- [x] Revisar que transferencia y aportación usan `p_request_id` y reconocen `ok` o `already_processed`.
- [x] Revisar aislamiento por usuario y descarte de respuestas tardías al cambiar de cuenta.
- [x] Comprobar que la app no incluye una clave service-role ni una clave privada.
- [ ] Validar que la APK proviene del commit auditado y que se instala y abre en Android.

## Avance técnico (2026-11-21)

La rama `feature/transfer-recovery-20261121` conserva en AsyncStorage la operación pendiente por usuario. Al iniciar sesión o reintentar, consulta el estado con la misma referencia idempotente, verifica tipo/importe/destinatario y bloquea operaciones nuevas hasta resolverla. Transferencias, conversiones y retiros descartan respuestas de red si el usuario cambió durante la solicitud. La recuperación de operaciones vuelve a comprobar la sesión después de cada espera asíncrona que puede preceder una actualización visible. Los retiros ficticios guardan la misma clave idempotente antes del RPC y la recuperan desde AsyncStorage; si el servidor ya creó la orden, el código de retiro no se vuelve a mostrar. Un bloqueo síncrono impide envíos dobles por toques rápidos.

Pasaron localmente y en GitHub Actions estas comprobaciones:

- `node scripts/audit-demo-static.cjs`
- `node scripts/audit-regression-safety.cjs`
- `node scripts/preflight-release-local.js`
- Exportación del bundle JavaScript para Android con Expo en CI.

Ejecuciones: [Preflight integral DEMO — bundle Android y auditorías](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/44852837992), [Auditoría estática DEMO](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/44852837983) y [Preflight anterior](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/44850789595). La exportación de Expo comprueba el bundle JavaScript; no construye ni instala una APK. La prueba integrada de pérdida de conexión y las pruebas Android siguen pendientes.

## Pruebas integradas pendientes — solo entorno de demostración

| Caso | Acción | Criterio de aceptación |
| --- | --- | --- |
| Transferencia normal | A envía 10.00 MWD a B | A -1000 centavos, B +1000; una operación contable |
| Reintento tras timeout | Repetir la misma solicitud con el mismo ID | Sin segundo débito; respuesta idempotente |
| Dos solicitudes simultáneas | Intentar gastar el mismo saldo dos veces | Sin saldo negativo ni doble gasto |
| Saldo insuficiente | Intentar transferir más del saldo disponible | Rechazo sin mutación |
| Acceso entre cuentas | A intenta leer saldo/operaciones privadas de B | RLS/RPC impiden lectura no autorizada |
| Cambio de sesión | Salir de A y entrar a B con actualización pendiente | Nunca mostrar datos de A en B |
| Fallo al refrescar | Confirmar operación y simular fallo de lectura posterior | Mostrar operación confirmada; no invitar a reenviar |
| Conversión Coin/Digital | Cotizar y confirmar, luego repetir confirmación | Una conversión, importes exactos y sin duplicación |
| Retiro ficticio | Crear retiro, doble toque, perder conexión o reiniciar y reintentar | Una orden por ID; la orden existente no vuelve a exponer el código y no se duplica |
| Android | Instalar APK verificada y abrirla | Sin cierre inesperado; navegación y sincronización funcional |

## Requisitos antes de cualquier lanzamiento real

- [ ] Revisión jurídica de licencias, modelo de socio regulado, BSA/AML, KYC, sanciones y protección al consumidor para EE. UU. → Honduras.
- [ ] Conciliación bancaria y contabilidad de doble partida con pruebas independientes.
- [ ] Gestión de fraude, límites, reversos, reclamaciones, monitoreo y auditoría.
- [ ] Revisión separada de custodia, reservas, emisión y regulación aplicable a activos digitales.
- [ ] Pruebas de penetración, recuperación, monitoreo y plan de incidentes.

**Regla de costos:** no iniciar ramas de base de datos de pago, builds en la nube ni servicios persistentes para completar esta matriz. Registrar evidencia antes de marcar cada casilla.
