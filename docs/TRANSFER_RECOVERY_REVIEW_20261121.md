# Revisión técnica de transferencias — 2026-11-21

## Alcance

Revisión estática de `App.js` y de las funciones/tablas de transferencia del proyecto Supabase. Se hicieron consultas de solo lectura al esquema y a agregados de conciliación. No se modificó la base ni se movieron créditos.

## Controles confirmados

- `mwd_transfer_demo` obtiene el remitente con `auth.uid()`; no acepta un ID de remitente enviado por el cliente.
- Valida cantidad positiva, máximo de operación e identificador de solicitud.
- Bloquea las dos billeteras en orden determinista antes de validar saldos y publicar el débito/crédito.
- La clave de idempotencia se verifica junto con remitente, destino, tipo e importe.
- La inserción en `mwd_operations` activa `mwd_auto_ledger_transfer_v1`. El trigger agrega dos asientos, uno débito y otro crédito, y publica la transacción contable en la misma operación de base de datos.
- Las políticas RLS observadas limitan lectura de billeteras al titular y movimientos a sus participantes.
- Los RPC de transferencia y estado no son ejecutables por `anon`; requieren usuario autenticado.

## Conciliación agregada observada

Consulta de solo lectura al estado actual de la base, el 2026-11-21:

| Control | Resultado |
|---|---:|
| Transferencias registradas | 19 |
| Transferencias sin asiento contable | 0 |
| Asientos de transferencia sin balance/estructura esperada | 0 |
| Claves de idempotencia duplicadas | 0 |
| Transacciones de transferencia en el libro | 19 |

Esto comprueba los registros existentes, no sustituye pruebas de concurrencia ni de fallos de red.

## Cambio técnico preparado en esta rama

En `App.js` la solicitud pendiente ahora se guarda en AsyncStorage con una clave por usuario antes de llamar al RPC. Al reabrir la app o reintentar, se consulta `mwd_operation_status_demo` con la misma referencia:

- Si ya está procesada, se comprueban tipo, importe y destinatario, se actualizan saldo e historial y se limpia la referencia.
- Si no está confirmada, la app conserva los datos y reintenta con el mismo `request_id`.
- Una referencia pendiente queda visible en Inicio; la app impide iniciar otra transferencia o aportación hasta resolverla.
- La referencia se conserva al cambiar de pantalla o cerrar sesión y queda aislada por ID de usuario. Si la consulta de estado falla, no se borra.

## Estado y límite de verificación

El cambio está en `audit/transfer-recovery-findings-20261121`. No se ejecutaron pruebas en un dispositivo ni se modificó Supabase; la verificación dinámica del flujo queda pendiente. Los créditos siguen siendo ficticios y este cambio no habilita operaciones con dinero real.
