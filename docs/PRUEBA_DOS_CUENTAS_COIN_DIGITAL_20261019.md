# Prueba de aislamiento Coin / Digital — 19 oct 2026

**Entorno:** Supabase de laboratorio, solo DEMO, sin depósitos, retiros ni activos emitidos.

## Comprobación ejecutada en SQL Editor

Se ejecutó una transacción `BEGIN ... SET LOCAL ROLE authenticated ... ROLLBACK` con dos cuentas ya existentes sin rol `owner`. Se usaron reclamos JWT de prueba con `set_config`, como simulación del contexto de sesión; **no se utilizaron tokens firmados ni acceso HTTP real**.

Comprobaciones realizadas:
1. Los dos perfiles obtenían billeteras que indicaban `sandbox_only` y `realPaymentsEnabled=false`.
2. Cuenta A: COIN → STABLE con cotización sintética; dos solicitudes con igual UUID conservaron `quoteId`. Modificar el importe con ese UUID fue rechazado (SQLSTATE 22023).
3. Cuenta A: primera confirmación `ok`, repetición `already_processed`, mismo `conversionId`, conciliación `executed`, diferencias de saldo Coin y STABLE consistentes.
4. Cuenta B: intentos de confirmar o conciliar la cotización de A rechazados (22023); billetera B sin cambios.
5. Cuenta B: STABLE → COIN: confirmación y conciliación consistentes, saldo actualizado.
6. Regreso a cuenta A: billetera A sin cambios después de la operación B; A no pudo inspeccionar la cotización de B (22023).
7. Se contabilizaron **cuatro rechazos** esperados.
8. Consulta previa: 0 rutas de tarifa real activadas, 0 corredores reales habilitados; tasa sintética activa y bolsa de pruebas suficiente.

**Resultado:** La ejecución terminó sin errores reportados. La transacción finalizó con `ROLLBACK`, por lo que las operaciones ensayadas no se guardaron.

## Riesgos y límites

- No se han validado **sesiones reales con JWT firmado** mediante el teléfono o la API.
- El éxito de una transacción SQL simulada no sustituye pruebas de concurrencia, una auditoría de RLS, pentesting, conciliación bancaria ni certificación legal.
- El PR #73 continúa como borrador hasta probar la APK en un Samsung físico con dos cuentas de ensayo autorizadas y revisar permisos.
- No convertir estos valores de prueba en saldos financieros ni habilitar producción.

## Siguiente verificación

Probar desde dos sesiones Android separadas: inicio/cierre de sesión, saldo e historial por cuenta, cambios de red, reintentos con la misma referencia y visualización sin datos de otra cuenta.