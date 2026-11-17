# Revision de concurrencia: pago frente a cancelacion (DEMO)

## Observaciones en el codigo actual de Supabase (lectura, sin modificaciones)

- `mwd_pay_merchant_demo(p_payment_id)` bloquea la fila de solicitud con `SELECT ... FOR UPDATE`, exige estado `pending`, realiza transferencia ficticia y luego marca `paid` dentro de la misma funcion transaccional.
- `mwd_cancel_payment_request_demo(p_payment_id)` bloquea la misma fila con `SELECT ... FOR UPDATE`, restringe la cancelacion al propietario del comercio, impide cancelar `paid` y cambia `pending` a `cancelled`.
- El bloqueo compartido de fila debe serializar pago y cancelacion para una solicitud concreta; falta una prueba real con dos sesiones PostgreSQL para verificar el resultado.

## Matriz esperada

| Orden de bloqueo | Resultado esperado | Movimiento de saldo |
| --- | --- | --- |
| Pago primero | `paid`; cancelacion rechazada | Un cargo y un abono |
| Cancelacion primero | `cancelled`; pago rechazado | Ninguno |
| Dos pagos simultaneos del mismo usuario | Uno `ok`, otro `already_processed` | Un cargo y un abono |
| Dos cancelaciones simultaneas del propietario | `cancelled` estable | Ninguno |
| Cancelacion por usuario ajeno al comercio | Rechazo | Ninguno |

## Pendiente

Ejecutar con usuarios autenticados distintos en una base aislada; comprobar que el saldo total se conserva, que solo hay una operacion por solicitud y que los errores no dejan estados parciales. No ejecutar escrituras en la base principal.
