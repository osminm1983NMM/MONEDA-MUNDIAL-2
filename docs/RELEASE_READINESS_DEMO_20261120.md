# Moneda Mundial 2.0 — puertas de salida (DEMO)

Estado: **NO APROBADO para dinero real**. Esta lista no equivale a resultados de pruebas. La rama principal no se modifica.

## Comprobaciones automatizables sin infraestructura de pago

- [x] Ejecutar las comprobaciones estáticas en CI y guardar el resultado.
- [x] Revisar que transferencia y aportación usan `p_request_id` y reconocen `ok` o `already_processed`.
- [x] Revisar aislamiento por usuario y descarte de respuestas tardías al cambiar de cuenta.
- [x] Comprobar que la app no incluye una clave service-role ni una clave privada.
- [x] Corregir y cubrir el estado ocupado del formulario de contraseña si cambia la sesión durante la solicitud.
- [x] Bloquear dobles toques en autenticación, conversiones y consulta/cancelación de retiros.
- [x] Invalidar cotizaciones obsoletas antes de confirmar una conversión.
- [x] Mantener visible la referencia pendiente antes de verificarla y bloquear nuevas operaciones si no se puede leer el almacenamiento local.
- [x] Liberar una referencia solo ante rechazo SQL definitivo; conservarla ante fallos de red o estados inciertos.
- [x] Bloquear los campos de autenticación mientras se envían solicitudes para evitar perder cambios del usuario.
- [x] Revisar de solo lectura las RPC de transferencia DEMO: actor desde `auth.uid()`, `search_path` vacío, sin ejecución de `anon`, y referencia idempotente única por actor.
- [ ] Validar que la APK proviene del commit auditado y que se instala y abre en Android.
- [ ] Agregar `com.monedamundial.app://auth/reset-password` a Redirect URLs en Supabase Auth.
- [ ] Probar el enlace de restablecimiento en el mismo teléfono, con la app abierta y cerrada, y luego iniciar sesión con la contraseña nueva.
- [ ] Confirmar que el enlace de un solo uso rechaza enlaces vencidos o ya consumidos.

## Avance técnico (2026-11-21)

La rama `feature/transfer-recovery-20261121` conserva en AsyncStorage las referencias idempotentes de transferencias, aportaciones y retiros por usuario. Al iniciar sesión o reintentar, consulta el estado con la misma referencia, verifica tipo/importe/destinatario y deja visible la operación pendiente aun cuando falle la consulta remota. Si no se puede leer o validar la referencia local, bloquea nuevas transferencias y aportaciones y permite reintentar la revisión sin borrar datos. Los rechazos SQL definitivos liberan la referencia; los conflictos de idempotencia, errores de conciliación y fallos de red conservan el estado para revisión o reintento seguro. Las transferencias, conversiones y retiros descartan respuestas tardías al cambiar de cuenta. Hay bloqueos síncronos contra dobles toques en acceso, conversiones y retiros; las cotizaciones se invalidan al cambiar el importe o activo, y la alerta verifica la cotización vigente antes de confirmarla. Una cotización vencida o un rechazo SQL definitivo la invalida; los errores de conciliación o respuesta incierta la conservan. Los campos de contraseña quedan bloqueados mientras se envía una solicitud.

Pasaron en GitHub Actions estas comprobaciones en el commit `fcfee30ddbc5a3ebf7344623f4e6410e0468afbd`:

- `node scripts/audit-demo-static.cjs`
- `node scripts/audit-regression-safety.cjs`
- `node scripts/preflight-release-local.js`
- Exportación del bundle JavaScript para Android con Expo en CI.

Ejecuciones: [Preflight integral DEMO — bundle Android y auditorías](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/44869734679) y [Auditoría estática DEMO](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/44869734684). El bundle no es una APK: no instala la app ni valida enlaces de email o almacenamiento nativo.

## Estado actual de contabilidad y permisos

El 21 de noviembre de 2026, el historial del Samsung mostró una transferencia recibida de 1.00 MWD a las 07:30:55 (Washington D. C.). Una consulta por destinatario, importe y segundo de creación encontró una operación y una transacción MWD publicada, vinculadas por la referencia `mwd-demo-transfer:<id de operación>`. Los dos asientos corresponden a un débito de 100 centavos al remitente y un crédito de 100 centavos al destinatario. El disparador `mwd_auto_ledger_transfer_v1` contabiliza las inserciones de tipo `transfer`. Esta comprobación cubre el envío normal de la demo.

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
| Referencia local ilegible | Forzar error de lectura de AsyncStorage al iniciar sesión | Bloquear nuevas operaciones y permitir reintentar la lectura |
| Rechazo SQL o error de red | Responder con SQLSTATE 400; luego simular desconexión sin respuesta | Rechazo definitivo permite corregir; desconexión conserva la misma referencia |
| Conversión Coin/Digital | Cotizar y confirmar, luego repetir confirmación | Una conversión, importes exactos y sin duplicación |
| Cotización vencida | Esperar vencimiento y confirmar | Rechazo visible, cotización invalidada y ningún cambio de saldo |
| Error de conciliación o timeout | Simular respuesta incierta durante confirmación | Conservar referencia y no ocultar posible estado pendiente |
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
