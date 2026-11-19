# Auditoría integral Moneda Mundial 2.0 — 2026-11-19

**Alcance:** demo de créditos ficticios. Este documento no certifica funcionamiento Android ni autoriza dinero real. Rama de revisión: `fix/pickup-retry-idempotency-20261119`. PR #125, sin fusionar.

## Verificado directamente
- Código de App.js y pruebas estáticas inspeccionados en GitHub.
- Corregida la expresión regular de entrada de cotizaciones: usar `\d` y `\.` dentro del literal RegExp, no `\\d` o `\\.`. Se agregó aserción estática; **no ejecutada en runner**.
- Supabase security advisors: 30 avisos informativos de tablas privadas con RLS sin políticas; 56 advertencias de funciones SECURITY DEFINER ejecutables por authenticated; 1 aviso de protección de contraseñas filtradas.
- Consulta de catálogo de funciones públicas: funciones MWD listadas no conceden EXECUTE a anon; funciones de negocio conceden EXECUTE a authenticated. **Esto NO prueba que todas validen autorización internamente**.

## Hallazgos y prioridades
1. **P0 / antes de dinero real:** revisar cada función SECURITY DEFINER, en especial `mwd_owner_*`, para verificar controles de rol/propiedad en su cuerpo; no retirar permisos en bloque.
2. **P1 / Android:** ejecutar pruebas de recuperación tras desconexión, respuesta perdida, reinicio y cambio de cuenta; validar idempotencia de transferencias y retiros.
3. **P1 / automatización:** ejecutar manualmente `.github/workflows/validar-demo.yml`; aún no hay ejecución verificada. Revisar instalación de dependencias y compilación real.
4. **P1 / aportaciones:** seis aportaciones ficticias requieren política de contrapartida antes de asientos nuevos.
5. **P1 / conversión:** comprobar valores con 1–6 decimales, límites, caducidad, doble confirmación y reintentos de red.
6. **P2 / seguridad Auth:** revisar configuración de protección de contraseñas filtradas en dashboard.
7. **P2 / dependencias:** fijar versiones y generar lockfile reproducible en un entorno con npm; no afirmar que npm install o Android build se ejecutaron.

## Condiciones de cierre
- Todas las comprobaciones automáticas ejecutadas y registradas, no solo inspeccionadas.
- Pruebas de Android T01–T17 ejecutadas con resultados documentados.
- Cero operaciones duplicadas, saldos negativos o asientos descuadrados después de las pruebas.
- Revisión de permisos privilegiados y protección de sesiones completada.
- Decisión contable explícita sobre aportaciones antes de activar su asiento.
- PR revisado antes de fusionar con main.

## Protección de costos
- No se creó rama temporal ni recurso de pago en Supabase.
- No se ejecutaron transacciones de prueba que alteren saldos.
- GitHub Actions continúa manual y pendiente de ejecución.

## Revisión de permisos privilegiados — evidencia adicional
- Se examinaron los cuerpos SQL de `mwd_transfer_demo`, `mwd_operation_status_demo`, `mwd_owner_summary_demo` y `mwd_owner_partner_save_demo`.
- Transferencia y consulta de estado verifican `auth.uid()` y vinculan la operación al actor; la transferencia valida el identificador idempotente antes de crear un segundo movimiento.
- De 38 funciones `mwd_owner_*` en `public`, **35 llaman un helper `assert_owner`** y **3 contienen referencias directas a `mwd_admin_roles`**. Se comprobó que los helpers de socios y remesas verifican el rol `owner` usando `auth.uid()`. La clasificación es evidencia estructural, no una prueba exhaustiva de acceso denegado.
- Pendiente: probar denegación real desde una cuenta autenticada no propietaria y revisar las restantes funciones SECURITY DEFINER no owner.

## Continuación técnica — validación local y correcciones
- Se ejecutaron **9 casos aislados** con Node.js 22 para la expresión regular de conversión; 9/9 correctos. No se ejecutó la suite completa del repositorio ni se compiló Android.
- Se corrigió el mensaje de error de creación de retiro para no afirmar falsamente que una orden no existe tras un timeout; se conserva la solicitud pendiente para recuperación.
- `package.json` ahora expone `npm test` para ejecutar la suite estática sin dependencias externas.
- PR #125 permanece en borrador, sin fusionar. La ejecución del workflow todavía no tiene resultados confirmados.

## Hallazgo crítico adicional — navegación y recuperación
- **Corregido:** `navigate()` borraba `pendingRef.current` y los campos de transferencia aun cuando existía una operación sin confirmar. Esto podía perder la referencia idempotente en memoria durante la sesión y causar una nueva solicitud al volver a enviar.
- Ahora la navegación preserva el identificador y los datos originales mientras haya una solicitud pendiente.
- Se añadieron dos aserciones estáticas de regresión: 17 comprobaciones declaradas en la suite.
- Verificación directa del texto de código actualizado: 4/4 condiciones comprobadas. **No equivale a ejecutar la suite Node ni a prueba Android.**

## Verificación integrada adicional — 19 noviembre 2026
- Recuento Supabase consultado sin escritura: **5 billeteras**, **25 operaciones**, de ellas **19 transferencias** y **6 aportaciones**; **0 billeteras con saldo negativo**. Este recuento no sustituye conciliación de asientos ni pruebas de concurrencia.
- Se corrigió el salto de línea mostrado al informar un retiro con respuesta incierta; antes se mostraba literalmente `\\n`.
- Entorno de ejecución local tiene Node 22, pero no dispone de acceso de red al repositorio privado. Por tanto, no se ha ejecutado aquí la suite completa de GitHub. La comprobación de GitHub Actions continúa pendiente de resultado verificable.
- Se mantiene prohibido fusionar PR #125 hasta obtener pruebas automatizadas, comprobación de Android y pruebas de autorización.

## Aislamiento entre cuentas y mensajes — revisión adicional
- **Corregido:** la referencia en memoria `pickupPendingRef` se restablece al cambiar `userId`, junto con monto, resultado y lista de retiros. La persistencia local continúa separada por usuario; no se eliminan solicitudes pendientes guardadas.
- **Corregido:** aviso de conversión no confirmada muestra salto de línea real en vez de texto `\\n`.
- Suite estática actualizada a **19 comprobaciones declaradas**. Se inspeccionaron las dos nuevas aserciones contra el código actual y ambas coincidieron; **no hay resultado de ejecución de la suite completa**.

## Integridad de operaciones confirmadas — limpieza local
- **Corregido:** después de una respuesta de éxito del servidor, un error de `AsyncStorage.removeItem` no vuelve a clasificar la transferencia ni la orden de retiro como no confirmada.
- En transferencias, si falla la limpieza local, se marca bloqueo de recuperación para evitar solicitudes nuevas sin resolver el estado persistido.
- En retiros, una futura repetición conserva el UUID almacenado y debe recibir respuesta idempotente del servidor.
- Dos comprobaciones estáticas añadidas; **21 aserciones declaradas**, ejecución completa de GitHub Actions todavía sin evidencia (consulta del último commit devolvió cero ejecuciones).
- **Limitación importante:** esta corrección no reemplaza pruebas de fallo real de almacenamiento, cambio de cuenta y respuesta perdida en Android.

## Recuperación de transferencias — dos rutas adicionales
- **Corregido:** tanto la ruta `already processed` antes del reintento como la comprobación de estado después de un timeout mantienen el resultado confirmado cuando falla `AsyncStorage.removeItem`.
- Si falla la limpieza local, se activa `pendingRecoveryErrorRef` para bloquear operaciones nuevas hasta recuperar el almacenamiento; se evita sugerir que la operación confirmada no existe.
- Suite estática ampliada a **23 comprobaciones declaradas**; no se debe afirmar que la suite pasó hasta ejecutarla en Node/GitHub Actions.
