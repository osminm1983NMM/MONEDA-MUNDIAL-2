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
