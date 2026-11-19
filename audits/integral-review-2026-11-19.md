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

## Recuperación de órdenes de retiro — importe original
- Se validan los importes guardados de retiros con límites propios: **100 a 100000 centavos** (1–1000 MWD ficticios), además de UUID válido.
- Si el usuario escribe un importe distinto al de la orden pendiente, la pantalla recupera el importe original y bloquea la nueva solicitud; no genera otro UUID.
- Dos aserciones estáticas nuevas; **25 comprobaciones declaradas**. La suite automatizada y Android siguen pendientes de ejecución verificable.

## Barrido de funciones privilegiadas — 19 noviembre 2026
- Consulta SQL de solo lectura: funciones `public.mwd_%` con `SECURITY DEFINER` y permiso `EXECUTE` para `authenticated` cuyo texto no contiene ninguna referencia a `auth.uid`, `assert_owner`, `assert_agent` ni `mwd_admin_roles`: **0 coincidencias**.
- Este resultado es **cribado textual**, no prueba de autorización por usuario ni garantía de seguridad; aún se requieren pruebas negativas con identidades reales de demostración y análisis de funciones auxiliares.
- No se modificaron funciones, roles, permisos, tablas ni datos.

## Pruebas ejecutables añadidas — 19 noviembre 2026
- Archivo nuevo `tests/pure-helpers.test.cjs`: extrae y ejecuta con `node:vm` las funciones reales `amountToCents`, `formatMWD` y `uniqueRequestId` de `App.js`.
- Cinco pruebas dinámicas: importes válidos, importes inválidos, formato de saldo, 500 UUID v4 sin colisión en la muestra y fallo cerrado sin aleatoriedad criptográfica.
- Workflow `.github/workflows/validar-demo.yml` actualizado para ejecutar también `node --test tests/pure-helpers.test.cjs` además de las 25 comprobaciones estáticas.
- **Importante:** se ha configurado la ejecución, pero aún no hay resultado de GitHub Actions verificado. Las pruebas de funciones puras no reemplazan pruebas de Supabase ni Android.

## Ejecución parcial real de funciones puras — 19 noviembre 2026
- Se recuperó `App.js` de la rama de desarrollo y se ejecutaron sus funciones originales `amountToCents` y `formatMWD` en un entorno JavaScript aislado.
- **Aprobados:** 7 casos de importes válidos, 12 casos de importes inválidos y 2 aserciones de formato de saldo; **0 discrepancias**.
- `uniqueRequestId` devolvió error por falta de `crypto.getRandomValues` en el entorno aislado. Esto es comportamiento seguro de fallo cerrado, **no** equivale a la prueba positiva de generación de 500 UUID. Esa prueba sigue pendiente en Node 22/Android.
- Estas comprobaciones parciales no prueban las 25 aserciones estáticas ni el workflow completo; no declarar CI verde.

## Estabilidad de sesión y navegación — 19 noviembre 2026
- **Corregido:** `onAuthStateChange` ya no fuerza `Inicio` ante `TOKEN_REFRESHED` u otros eventos distintos de `SIGNED_IN`/`SIGNED_OUT`. Evita interrumpir pantallas de transferencia, conversión o retiro durante renovación automática del token.
- Añadida comprobación estática específica; **26 comprobaciones declaradas**, más 5 pruebas dinámicas preparadas. No confundir con ejecución integral aprobada.
- Riesgo residual: comprobar en Android la renovación de sesión durante solicitudes pendientes y el cierre de sesión con dos cuentas.

## Protección de doble pulsación — 19 noviembre 2026
- **Corregido:** creación de retiro, cancelación de retiro y confirmación de conversión ahora tienen bloqueo sincrónico mediante `useRef`, además de su estado React de carga. El bloqueo se activa antes del primer `await` y se libera en `finally`.
- Motivo: `setState` no bloquea de forma inmediata una segunda invocación dentro del mismo ciclo de render; dos pulsaciones rápidas podían enviar solicitudes concurrentes, incluso con UUID distintos para nuevos retiros.
- Se agregaron tres comprobaciones estáticas: **29 comprobaciones declaradas**. Pruebas Android de doble pulsación y verificación de idempotencia de servidor siguen pendientes.

## Cotizaciones concurrentes — 19 noviembre 2026
- `requestSwapQuote` ahora usa bloqueo sincrónico `swapQuoteBusyRef`, activado solo tras validar la cantidad y liberado en `finally`. Evita solicitudes simultáneas por pulsaciones rápidas.
- `confirmSwap` también verifica el bloqueo de cotización, evitando confirmar una cotización mientras se solicita otra.
- Dos comprobaciones estáticas adicionales: **31 declaradas**; requieren ejecución de suite y Android antes de aprobar.

## Integración de pruebas — 19 noviembre 2026
- Se corrigió una aserción obsoleta de la suite estática: ahora verifica el bloqueo completo de confirmación de conversiones, incluido `swapQuoteBusyRef`. Antes, la aserción exigía una cadena antigua y podía fallar ante la corrección vigente.
- `package.json` ahora define `npm test` como `node --test tests/*.test.cjs`, para incluir tanto las comprobaciones estáticas como las pruebas ejecutables de funciones puras.
- Estas modificaciones no equivalen a ejecución completa confirmada. Continúa pendiente un resultado verificable de CI/Node y la validación Android.

## Verificación directa de base de datos — 19 noviembre 2026
Consulta SQL de solo lectura ejecutada sobre el proyecto Supabase `egrsdrlpavrtbgxoyxvg`:
```sql
select (select count(*) from public.mwd_operations where kind='contribution') as contributions,
       (select count(*) from public.mwd_operations where kind='transfer') as transfers,
       (select count(*) from public.mwd_wallets where balance_cents < 0) as negative_wallets;
```
**Resultado:** 6 aportaciones, 19 transferencias, 0 billeteras con saldo negativo. La consulta no modifica datos y no prueba por sí misma conciliación completa, idempotencia ni integridad de todas las entradas contables. Sigue pendiente la decisión sobre el tratamiento en el libro mayor de las aportaciones.

## Respuestas tardías de cotizaciones — 19 noviembre 2026
- La solicitud de cotización captura una revisión monotónica y el usuario. Antes de mostrar la respuesta, verifica que sigan siendo los vigentes.
- Cambiar cantidad, activo de origen o usuario invalida respuestas anteriores, evitando mostrar cotizaciones obsoletas después de un retraso de red.
- Dos nuevas comprobaciones estáticas; **33 declaradas**. Pendiente ejecutar suite completa y validar carrera real de red en Android.

## Aislamiento de respuestas tardías de saldo e historial — 19 noviembre 2026
- `refreshAccount` incrementa una revisión de solicitud y verifica que siga siendo la última, además de confirmar que el usuario de sesión corresponda a la cuenta consultada antes de actualizar billetera, historial o rol.
- Respuestas y errores de consultas anteriores ya no sobreescriben la pantalla ni el estado de carga de consultas más recientes. El cambio de cuenta invalida respuestas previas y limpia la indicación de sincronización.
- Dos aserciones estáticas nuevas; **35 comprobaciones declaradas**, pendientes de ejecución completa y validación Android con dos cuentas.

## Aislamiento de consultas de conversión y retiros — 19 noviembre 2026
- Las respuestas de `mwd_conversion_wallet_demo` y `mwd_pickup_my_orders_demo` se aplican solo cuando corresponden a la revisión de consulta más reciente y al usuario que la inició.
- El cambio de cuenta invalida las revisiones pendientes y limpia indicadores de carga para impedir que respuestas antiguas sobrescriban datos visibles de la cuenta nueva.
- Dos aserciones estáticas adicionales: **37 comprobaciones declaradas**. Pendiente ejecutar la suite y simular cambios de cuenta con red lenta en Android.

## Confirmaciones de conversión tardías — 19 noviembre 2026
- Las respuestas de confirmación de conversión capturan revisión y usuario de origen. Si el usuario cambió de cuenta o invalidó la cotización, la respuesta no modifica el formulario, saldo ni muestra avisos en la pantalla posterior.
- Errores tardíos de solicitud de cotización también se descartan si la solicitud dejó de estar vigente.
- La confirmación en servidor no se revierte: se evita únicamente una actualización visual perteneciente a una cuenta o cotización anterior.
- Dos comprobaciones estáticas adicionales, **39 declaradas**. Pendiente ejecutar pruebas integrales Android con cambios de cuenta durante RPC.

## CI real — 19 noviembre 2026
- Se consultó el workflow de GitHub Actions del PR #125, ejecución `44543481994` (commit `c1d83c11`): **failure**.
- Falló la aserción estática `pickup request memory must be cleared on account switch` en la línea 57, porque esperaba una cadena contigua de líneas que dejó de existir al añadir revisiones de seguridad al mismo efecto. El código de limpieza sí conserva las llamadas requeridas.
- Se corrigió el test para inspeccionar el efecto de cambio de cuenta y verificar las cuatro operaciones por separado, sin depender de su adyacencia. Commit `ad1c2e3b`.
- El workflow anterior no ejecutó la suite de funciones puras porque se detuvo en la prueba estática. **No se declara CI verde** hasta obtener una nueva ejecución satisfactoria.

## CI verde confirmado — 19 noviembre 2026
- Ejecución GitHub Actions `44543625068` (run #229), PR #125, commit `b7dcd6ecc7b3d108edf820cad46130405b0af846`: **completed / success**.
- Pasos satisfactorios: validación JSON de `package.json`, comprobaciones estáticas de recuperación/idempotencia y pruebas ejecutables de funciones puras.
- Esta validación no incluye instalación de dependencias Expo, compilación APK, dispositivo Android ni simulación de desconexión real; siguen pendientes.

## Unificación del control automático — 19 noviembre 2026
- El workflow `.github/workflows/validar-demo.yml` ejecuta ahora `npm test`, que incluye ambas suites `tests/*.test.cjs`, en lugar de dos invocaciones independientes.
- La ejecución #229 previa estaba verde; esta modificación del workflow requiere su propia ejecución de CI para considerarse validada. Se preserva el diseño sin instalación de Expo ni compilación Android para minimizar consumo.

## Verificación SQL de solo lectura y CI unificado — 19 noviembre 2026
- GitHub Actions run #232 (`44543814818`): job `Sintaxis y controles DEMO` **completed / success**; pasos de sintaxis JSON y `npm test` satisfactorios. Al consultar la ejecución principal figuraba `in_progress` mientras el job ya estaba finalizado.
- Esquema confirmado: `mwd_operations` con `actor_id`, `request_id`, `kind`, `source_user_id`, `destination_user_id`, `amount_cents`; `mwd_wallets` con `user_id`, `balance_cents`.
- SQL lectura: **19 transferencias / 21,700 centavos ficticios**, **6 aportaciones / 2,400 centavos ficticios**; **5 billeteras / 4,997,600 centavos ficticios de saldo agregado**.
- Resultado 0 en: billeteras negativas, importes no positivos, solicitudes duplicadas por par `(actor_id,request_id)`, solicitudes sin ID, transferencias sin origen/destino, autotransferencias, aportaciones sin origen, aportaciones con destino, operaciones que referencian billeteras de origen/destino inexistentes.
- Las aportaciones reducen el saldo de origen y no tienen destinatario en `mwd_operations`; queda **pendiente definir la contrapartida contable** antes de afirmar conciliación completa. No se modificaron datos ni estructura.

## Conciliación cruzada de libro mayor — 19 noviembre 2026
- Auditoría SQL **solo lectura** en `mwd_finance_private`: 5 cuentas, 19 transacciones `wallet_transfer` en estado `posted` y moneda `MWD`, 38 asientos. **0** transacciones descuadradas (sumas debit/credit), con menos de 2 asientos, con asientos inválidos o con asientos huérfanos.
- Se identificó formato de referencia `mwd-demo-transfer:<operation_id>`. Cruce de `public.mwd_operations` (kind transfer) contra `ledger_transactions.external_reference`: **19/19** coincidencias, **0** transferencias sin registro contable.
- En las 19 transferencias coinciden importes de débitos y créditos con `amount_cents`; cada una tiene un débito de cuenta perteneciente al origen y un crédito de cuenta perteneciente al destino. **0** discrepancias de importe o de dirección/propietario.
- **Alcance:** conciliación de transferencias existentes en el libro mayor, no reconstrucción histórica de saldos iniciales ni certificación de concurrencia. Las **6 aportaciones** por 2,400 centavos ficticios siguen sin contrapartida contable definida y no se generaron asientos.

## Auditoría ampliada de funciones y aportaciones — 19 noviembre 2026
- Catálogo de `public.mwd_%` con `SECURITY DEFINER`: las funciones consultadas no conceden `EXECUTE` a `anon`; las accesibles por `authenticated` contienen referencias textuales a `auth.uid`/helpers de autorización y declaran `SET search_path`. Es **cribado estructural**, no una prueba de denegación efectiva ni auditoría exhaustiva de llamadas auxiliares.
- Se examinó el cuerpo SQL exacto de `public.mwd_contribute_demo(bigint,uuid)`: exige `auth.uid()`, valida cantidad/UUID, bloquea la billetera `FOR UPDATE`, consulta solicitud anterior para idempotencia, descuenta `balance_cents` e inserta `public.mwd_operations` de tipo `contribution`. **No inserta asientos en `mwd_finance_private.ledger_transactions` ni `ledger_entries`**.
- Las seis aportaciones ficticias registradas (2,400 centavos) no deben interpretarse como movimientos de doble entrada conciliados. **Decisión pendiente**: cuenta de destino/contrapartida y política de contabilización histórica. No se ejecutó DDL ni DML.
- Estado CI comprobado antes de esta actualización: run #233, `completed/success` en commit `bfcb3ced`. Los cambios documentales posteriores no son pruebas de Android.
