# Pruebas manuales — Android (DEMO, sin dinero real)

Rama: `fix/mobile-swap-validation-pickup-idempotency`. No fusionar antes de verificar en Android.

## Conversión Coin / Digital
1. Iniciar sesión, abrir **Coin / Digital** y comprobar que la billetera de prueba carga.
2. Introducir `1`, `1.5`, `1,5`, `0.000001`, `10000`: deben superar la validación de formato; el servidor aún puede rechazar por saldo o límites.
3. Introducir `1.1234567`, `1abc`, `1..2`, `-1`, `10000.000001`, vacío: deben rechazarse o no llegar a confirmar cotización.
4. Solicitar cotización y modificar el importe: la cotización anterior debe desaparecer.
5. Confirmar una cotización vencida: debe requerir una nueva.

## Retiros ficticios (Honduras)
6. Crear retiro de prueba con monto permitido; confirmar que aparece en **Mis retiros ficticios**.
7. Simular fallo de red tras enviar la solicitud (no repetir rápidamente). Reintentar **sin cambiar el monto**: debe reutilizar el identificador de solicitud y no crear una segunda orden. Verificar conteo en Supabase.
8. Cambiar el monto tras fallo: debe usar un identificador distinto.
9. Cambiar de cuenta o cerrar sesión después de un fallo: el identificador pendiente y los resultados del usuario anterior no deben reutilizarse ni mostrarse.
10. Cancelar una orden pendiente y actualizar lista; comprobar estado y evento.
11. Comprobar que una orden vencida aparece como `expired` en la consulta.
12. Confirmar que la pantalla muestra siempre **SOLO DEMOSTRACIÓN • SIN DINERO REAL**.

## Seguridad y criterios de aprobación
- Todas las órdenes, códigos y saldos son ficticios.
- Comprobar con dos cuentas diferentes que cada una solo ve sus órdenes.
- Repetir solicitudes de forma controlada y comparar IDs y número de filas antes/después.
- No considerar aprobada la corrección por revisión estática solamente: se requiere prueba Android + consulta de datos.
- No activar pagos reales ni fusionar a `main` hasta superar las pruebas.

## Cambio de sesión durante operaciones en curso
13. Cuenta A: iniciar actualización de saldo y cambiar a B antes de la respuesta; jamás debe mostrarse el saldo ni historial de A en B.
14. Cuenta A: iniciar cotización Coin/Digital y cerrar sesión; la cotización no debe mostrarse en una sesión posterior.
15. Cuenta A: confirmar una conversión ficticia y cambiar a B; el resultado de A no debe actualizar la billetera de B. Comprobar en servidor si A procesó la operación.
16. Cuenta A: iniciar consulta de retiros y cambiar a B; descartar lista y errores tardíos de A.
17. Cuenta A: iniciar creación de retiro y cambiar a B; no mostrar resultado ni error de A en B. Verificar si el servidor creó la orden en A.
18. Cuenta A: cancelar un retiro y cambiar a B; no mostrar notificación de cancelación de A en B; consultar estado de A por separado.
19. Cuenta A: iniciar transferencia y cambiar a B; no mostrar éxito/error de A en B; consultar ambos historiales y verificar que no se duplicó.
20. Pulsar actualizar dos veces en momentos cercanos (cuando esté disponible); una respuesta anterior no debe sobrescribir una más reciente.

**Criterio crítico:** no usar estas pruebas para afirmar que una petición se canceló en el servidor al cambiar de cuenta. Los RPC pueden finalizar; verificar su resultado en el historial y en la base de datos.

## Confirmación del servidor frente a error de actualización
21. Ejecutar una transferencia ficticia exitosa y provocar fallo solo al refrescar el historial: debe indicar operación confirmada; no repetir el envío automáticamente.
22. Ejecutar conversión ficticia exitosa y provocar fallo solo al consultar saldos: debe indicar conversión confirmada y actualización pendiente, nunca «conversión no confirmada».
23. Tras el caso anterior, pulsar **Consultar saldos** y verificar el saldo en el servidor antes de otra conversión.
24. Provocar error en el RPC de conversión antes de obtener confirmación: debe mostrarse operación no confirmada y no inventar un resultado exitoso.
