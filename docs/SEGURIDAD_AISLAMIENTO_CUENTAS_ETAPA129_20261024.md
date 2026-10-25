# Moneda Mundial 2.0 — Etapa 129: auditoría de separación de cuentas

**Fecha:** 24 de octubre de 2026 (hora de Washington, D. C.).  
**Ámbito:** laboratorio Supabase, metadatos de catálogo y lectura de definiciones SQL; sin operaciones financieras reales.

## Resultado observado

| Verificación (solo lectura) | Resultado | Interpretación |
| --- | ---: | --- |
| Tablas de `public` con RLS habilitada | 6 de 6 | Capa inicial de aislamiento presente. |
| Políticas RLS de `public` | 10 | Filtran el usuario propietario o participante; ver política por política. |
| Funciones `SECURITY DEFINER` de `public` | 55 | Superficie a revisar individualmente. |
| Funciones ejecutables por `authenticated` | 54 | La advertencia del asesor identifica privilegio, no explotación demostrada. |
| Funciones ejecutables por `anon` | 0 | No se observó exposición a la función por rol anónimo. |
| Funciones sin configuración explícita de `search_path` | 0 | Buena defensa frente a sustitución de objetos por ruta de búsqueda. |
| Funciones `authenticated` que mencionan `auth.uid()` o `assert_owner()` | 54 de 54 | Indicio favorable; **no** demuestra que todas las ramas protejan datos y escrituras. |

**Tablas examinadas:** `mwd_admin_roles`, `mwd_merchants`, `mwd_operations`, `mwd_payment_requests`, `mwd_profiles`, `mwd_wallets`.

**Políticas destacadas:** la billetera y el perfil se consultan con `auth.uid() = user_id`. El historial de operaciones se permite al remitente o destinatario. La lectura de comercios se limita al propietario. Las solicitudes de pago pendientes son consultables por una función específica para habilitar el flujo de cobro, no por la política de lectura directa del cliente.

## Revisión manual selectiva de funciones

Se inspeccionaron sus definiciones actuales, sin ejecutarlas ni cambiar saldos.

- `mwd_transfer_demo`: obtiene el actor de `auth.uid()`, comprueba entrada, bloquea las dos filas de billetera, debita solo al actor y maneja `request_id` repetido con verificación de datos. La cuenta destino se resuelve por código de cuenta, como requiere el envío ficticio.
- `mwd_pay_merchant_demo`: exige sesión, impide pagarse a sí mismo, bloquea la solicitud pendiente y usa `mwd_transfer_demo` para el pago. Una solicitud de pago pendiente es accesible por referencia a un posible pagador; se debe verificar que únicamente divulgue datos comerciales apropiados.
- `mwd_conversion_confirm_demo` y `mwd_conversion_reconcile_demo`: buscan la cotización con `user_id = auth.uid()`; la confirmación bloquea cotización, bolsa de prueba y saldos y rechaza estados no válidos.
- `mwd_history_demo` y `mwd_operation_status_demo`: acotan la consulta a operaciones del usuario autenticado.
- `mwd_owner_remittance_create_demo` y `mwd_owner_conversion_policy_demo`: pasan por funciones privadas `assert_owner()` que comparan `auth.uid()` con `public.mwd_admin_roles.role='owner'`.
- `mwd_agent_my_scope_demo`: restringe alcance de agente al usuario autenticado y asignaciones activas.

**No detectamos un fallo evidente en esos caminos inspeccionados**, pero sigue pendiente auditar el resto de funciones y sus dependencias. No interpretar esta revisión parcial como certificación de seguridad.

## Lo que aún NO se ha demostrado

1. Dos sesiones independientes con **JWT reales distintos**: A no puede listar ni modificar recursos privados de B, y viceversa.
2. Que B no pueda confirmar ni conciliar la cotización Coin/Digital creada por A, incluso conociendo el UUID.
3. Que una repetición de pago o transferencia no duplique cargos y que una solicitud reutilizada con datos diferentes sea rechazada.
4. Que todos los caminos de las 54 funciones con rol `authenticated` validan apropiadamente actor, pertenencia, estado e idempotencia.
5. Que caducidad, cierre de sesión y recuperación de cuenta invalidan correctamente el acceso en Android real.
6. La firma oficial de distribución: el APK anterior pasó pruebas de emulador **con certificado Android Debug**, no con firma de publicación.

La rama independiente de la [PR #83](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/pull/83) incluye una guía A→B→A con pruebas simuladas, pero no ofrece todavía evidencias de dos JWT reales y no está fusionada en esta rama.

## Próxima puerta de aceptación

| Prueba | Resultado esperado | Evidencia a conservar |
| --- | --- | --- |
| A consulta sus tablas RLS | Solo filas de A | Resumen de conteos, sin datos personales |
| A intenta leer perfiles/billeteras de B | Cero filas | Registro de prueba, sin tokens |
| B intenta usar cotización de A | Error controlado, saldo igual | Código de error y saldos ficticios antes/después |
| A y B consultan su historial Coin/Digital | Ninguna conversión ajena | Identificadores de operaciones anonimizados |
| Reintento de transferencia ficticia | Un único cargo o error por datos distintos | Conteo de operaciones, sin transferencias reales |
| Sesión revocada o cerrada | Acceso denegado | Estado de autenticación y error |

**Condiciones antes de ejecutar:** dos cuentas de prueba creadas y autorizadas para laboratorio, respaldo o reinicialización de saldos ficticios, ningún JWT ni contraseña guardado en GitHub. No ejecutar movimientos de prueba nuevos sin acordar montos y cuentas. No ejecutar tests con la llave `service_role`, porque bypass RLS falsearía la verificación.

## Archivo reproducible

`scripts/security_rpc_readonly_audit.sql` consulta únicamente `pg_catalog` y las definiciones de funciones privadas `assert_owner()`; no contiene `INSERT`, `UPDATE`, `DELETE`, `GRANT`, `REVOKE` ni migraciones.

**Estado de la etapa:** revisión documental y automática de metadatos concluida; auditoría funcional A/B pendiente. Mantener toda la propuesta en **borrador**, sin fusionar y sin dinero real.
