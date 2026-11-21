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

## Hallazgo que requiere corrección en la app

En `App.js`, la clave de reintento se guarda solo en `pendingRef` (memoria del proceso). El RPC `mwd_operation_status_demo` existe en la base, pero la app no lo consulta. Si Android cierra el proceso, el usuario sale de la pantalla o cambia los datos tras un tiempo de espera ambiguo, se pierde la referencia local. El siguiente envío podría generar una clave nueva aunque el primer envío ya se hubiera confirmado.

### Corrección propuesta

1. Persistir la solicitud pendiente en almacenamiento local por usuario antes del RPC: tipo, importe, destino y `request_id`.
2. Al reabrir la app o reintentar, consultar `mwd_operation_status_demo` con ese `request_id`.
3. Si está procesada, actualizar saldo e historial y limpiar la solicitud guardada.
4. Si sigue sin confirmar, permitir reintentar con el mismo `request_id`; no generar uno nuevo hasta resolver la solicitud anterior.
5. Limpiar el registro local al cerrar sesión y comprobar que una solicitud guardada nunca se muestre a otra cuenta.

## Estado

La lógica de transferencia y el asiento contable observado están bien conectados para la demostración. La recuperación de una respuesta ambigua al cerrar la app sigue pendiente en el cliente. Estos hallazgos no autorizan mover dinero real; las transferencias actuales son créditos ficticios.
