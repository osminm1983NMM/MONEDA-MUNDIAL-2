# Verificación de funciones SQL desplegadas — 2026-11-19

Inspección **solo lectura** de funciones reales en Supabase (proyecto `egrsdrlpavrtbgxoyxvg`). No se ejecutaron operaciones financieras ni cambios de esquema.

## Resultados
- `mwd_transfer_demo`: comprueba `auth.uid()`, bloquea las dos billeteras ordenadas por ID con `FOR UPDATE`, verifica duplicado por `actor_id + request_id` antes de modificar saldos y realiza ambos UPDATE e INSERT dentro de una única función transaccional. Rechaza autoenvíos, saldo insuficiente y exceso de límite del destinatario.
- `mwd_contribute_demo`: bloquea la billetera del emisor, busca solicitudes existentes y comprueba el importe antes de debitar. Una llamada simultánea con el mismo emisor se serializa por el bloqueo de billetera.
- `mwd_pickup_create_demo`: usa bloqueo advisory por usuario, busca el identificador previo, valida datos, limita a cinco órdenes por hora y utiliza `ON CONFLICT DO NOTHING` con nueva comprobación. **No financia la orden ni paga dinero:** el resultado declara `isFunded=false`, `canPayOut=false`, `realPaymentsEnabled=false`.
- Las cinco RPC revisadas (`mwd_transfer_demo`, `mwd_contribute_demo`, `mwd_pickup_create_demo`, `mwd_pickup_cancel_demo`, `mwd_conversion_confirm_demo`) permiten EXECUTE a `authenticated`, no a `anon`, y están marcadas SECURITY DEFINER. Debe mantenerse una revisión exhaustiva de autorización por función.
- `mwd_wallets`, `mwd_operations`, `mwd_admin_roles`: RLS habilitado y políticas SELECT para propietario o participante.
- El asesor de seguridad de Supabase informó hallazgos informativos de tablas privadas sin políticas y advertencias por RPC SECURITY DEFINER ejecutables por usuarios autenticados. **No corregir masivamente**: los esquemas privados pueden estar cerrados intencionalmente y algunas RPC requieren privilegios controlados.

## Límites de esta verificación
La inspección de código SQL no sustituye pruebas simultáneas reales, validación de invariantes contables, auditoría de roles efectivos, ni pruebas de Android. El comportamiento frente a fallos de red debe probarse con dos cuentas ficticias.

## Siguientes pruebas con evidencia
1. Ejecutar dos transferencias simultáneas con el mismo ID y comprobar exactamente una fila y un débito/crédito.
2. Reintentar el mismo ID con distinto monto o destinatario: debe rechazarse sin cambios.
3. Simular timeout tras commit y confirmar `already_processed`.
4. Verificar que las RPC `SECURITY DEFINER` solo consultan/modifican recursos autorizados.
5. Confirmar que la orden de retiro ficticio permanece sin fondos y sin capacidad de pago.
6. Ejecutar comprobaciones de GitHub Actions y arranque Android en emulador.

Referencia de avisos: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
