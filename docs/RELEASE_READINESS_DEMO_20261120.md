# Moneda Mundial 2.0 — puertas de salida (DEMO)

Estado: **NO APROBADO para dinero real**. Esta lista no equivale a resultados de pruebas. La rama principal no se modifica.

## Comprobaciones automatizables sin infraestructura de pago

- [x] Ejecutar las comprobaciones estáticas en CI y guardar el resultado.
- [x] Revisar que transferencia y aportación usan `p_request_id` y reconocen `ok` o `already_processed`.
- [x] Revisar aislamiento por usuario y descarte de respuestas tardías al cambiar de cuenta.
- [x] Comprobar que la app no incluye una clave service-role ni una clave privada.
- [x] Corregir y cubrir el estado ocupado del formulario de contraseña si cambia la sesión durante la solicitud.
- [x] Revisar de solo lectura las RPC de transferencia DEMO: actor desde `auth.uid()`, `search_path` vacío, sin ejecución de `anon`, y referencia idempotente única por actor.
- [ ] Validar que la APK proviene del commit auditado y que se instala y abre en Android.
- [ ] Agregar `com.monedamundial.app://auth/reset-password` a Redirect URLs en Supabase Auth.
- [ ] Probar el enlace de restablecimiento en el mismo teléfono, con la app abierta y cerrada, y luego iniciar sesión con la contraseña nueva.
- [ ] Confirmar que el enlace de un solo uso rechaza enlaces vencidos o ya consumidos.

## Avance técnico (2026-11-21)

La rama `feature/transfer-recovery-20261121` conserva en AsyncStorage la operación pendiente por usuario. Al iniciar sesión o reintentar, consulta el estado con la misma referencia idempotente, verifica tipo/importe/destinatario y bloquea operaciones nuevas hasta resolverla. Transferencias, conversiones y retiros descartan respuestas de red si el usuario cambió durante la solicitud. La recuperación de operaciones vuelve a comprobar la sesión después de cada espera asíncrona que puede preceder una actualización visible. Los retiros ficticios guardan la misma clave idempotente antes del RPC y la recuperan desde AsyncStorage; si el servidor ya creó la orden, el código de retiro no se vuelve a mostrar. Un bloqueo síncrono impide envíos dobles por toques rápidos. Si falla la lectura de AsyncStorage, la pantalla principal ofrece reintentar la verificación sin cerrar sesión.

Pasaron en GitHub Actions estas comprobaciones en el commit `979ab8ae42b4c8bc5b36b288ae9ee35595642359`:

- `node scripts/audit-demo-static.cjs`
- `node scripts/audit-regression-safety.cjs`
- `node scripts/preflight-release-local.js`
- Exportación del bundle JavaScript para Android con Expo en CI.

Ejecuciones: [Preflight integral DEMO — bundle Android y auditorías](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/44856383942) y [Auditoría estática DEMO](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/44856383971). El bundle no es una APK: no instala la app ni valida enlaces de email o almacenamiento nativo.

## Estado actual de contabilidad y permisos

La lectura de Supabase encontró 25 operaciones de billetera DEMO con 25 referencias distintas y un índice único sobre `(actor_id, request_id)`. Las RPC de esta billetera actualizan saldos ficticios y guardan `mwd_operations`; no generan asientos en el ledger financiero.

El ledger financiero, que es un flujo separado, tenía 19 transacciones `wallet_transfer` publicadas y balanceadas: 38 asientos, sin faltantes de débito/crédito ni diferencias. No presentar ambos conjuntos como una conciliación única. Las comprobaciones fueron de solo lectura y no modificaron la base de datos.

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

- [ ] Habilitar la protección contra contraseñas filtradas en Supabase Auth.
- [ ] Completar la [configuración y prueba de recuperación de contraseña](AUTH_PASSWORD_RESET_SETUP.md).
- [ ] Probar permisos y rechazos de cada RPC privilegiada con usuarios de prueba.
- [ ] Revalidar privilegios de esquemas privados después de cada cambio de backend.
- [ ] Consultar la [revisión de seguridad de Supabase (solo lectura)](SUPABASE_SECURITY_REVIEW_20261121.md).

- [ ] Revisión jurídica de licencias, modelo de socio regulado, BSA/AML, KYC, sanciones y protección al consumidor para EE. UU. → Honduras.
- [ ] Conciliación bancaria y contabilidad de doble partida con pruebas independientes.
- [ ] Gestión de fraude, límites, reversos, reclamaciones, monitoreo y auditoría.
- [ ] Revisión separada de custodia, reservas, emisión y regulación aplicable a activos digitales.
- [ ] Pruebas de penetración, recuperación, monitoreo y plan de incidentes.

**Regla de costos:** no iniciar ramas de base de datos de pago, builds en la nube ni servicios persistentes para completar esta matriz. Registrar evidencia antes de marcar cada casilla.
