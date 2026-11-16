# Revisión de bloqueos y códigos de retiro ficticios

Fecha: 2026-11-16. Inspección de solo lectura de las definiciones SQL reales en Supabase.

## Funciones revisadas

1. mwd_owner_issue_pickup_code_demo: invoca assert_owner(), bloquea la orden y la asignación con FOR UPDATE, exige orden simulated y asignación planned, bloquea el registro del código existente, no vuelve a revelar el secreto al reintentar, crea un token DEMO de 32 caracteres hexadecimales y almacena su hash; caduca a los 30 minutos.
2. mwd_owner_try_pickup_code_demo: invoca assert_owner(), bloquea la fila del código con FOR UPDATE OF c, asocia request_id con huella del código para idempotencia, verifica caducidad, bloquea tras cinco fallos, requiere revisión de identidad simulada y marca el código como consumed. Devuelve money_paid=false y real_payments_enabled=false en la respuesta de consumo.
3. mwd_owner_complete_payout_sample_demo: invoca assert_owner(), bloquea orden, asignación y código con FOR UPDATE; exige orden simulated, asignación planned, código consumed, consume_request_id, identidad simulada y evento consumed; actualiza asignación a sample_completed y registra evento. Un reintento con la misma referencia retorna already_processed=true; con otra referencia rechaza el cierre repetido.

## Precauciones

- El bloqueo y la idempotencia se han comprobado por inspección del SQL, no mediante ejecución concurrente.
- El flujo es enteramente ficticio y no prueba una identidad real ni entrega dinero.
- Revisar en laboratorio el bloqueo concurrente de códigos, cinco intentos fallidos, vencimiento, reintentos de finalización y la unicidad de eventos.
- Revisar por separado restricciones únicas de las tablas y todas las rutas de error antes de habilitar operaciones reales.

No se ejecutaron operaciones de escritura ni se modificaron saldos, funciones o permisos.