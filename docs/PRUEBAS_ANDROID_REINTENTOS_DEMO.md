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

## Recuperación de transferencias tras navegar
25. Iniciar una transferencia ficticia, simular pérdida de respuesta y regresar a Inicio: al volver a Transferir, el importe y destinatario deben conservarse para reintentar con la misma clave.
26. Tras ese error, pulsar «Mis movimientos» y volver a Transferir: no se debe generar una segunda solicitud al repetir exactamente los mismos datos.
27. Cambiar importe o destinatario después del fallo: se debe crear una nueva clave; verificar que no se confunda con el intento previo.
28. Solicitar una cotización y cambiar de usuario mientras falla la red: no mostrar un error tardío de la cuenta anterior.
29. Confirmar que los mensajes de conversión muestran un salto de línea real, no los caracteres literales barra invertida y n.

## Reintentos con saldo ya debitado
30. Cuenta A con saldo ficticio suficiente: ejecutar una transferencia y simular pérdida de respuesta tras el débito. Refrescar saldo, volver a Transferir y reintentar exactamente mismo importe y destinatario: debe usar la misma clave aunque el saldo mostrado ya sea inferior al importe.
31. Confirmar que el diálogo del caso 30 identifica el reintento de la misma solicitud. Verificar en el libro mayor que solo exista un movimiento y que el RPC responda idempotentemente.
32. Cambiar importe o destinatario después del caso 30: debe tratarse como solicitud nueva y aplicar la validación de saldo, sin reutilizar la clave anterior.
33. Repetir los casos 30–32 con aportación ficticia. Comprobar que no se duplica el débito.
34. Cambiar de cuenta entre el intento incierto y el reintento: la cuenta B no debe reutilizar la clave de A.

## Renovación de sesión y sincronización
35. Mantener abierta Transferir con importe y destinatario escritos; renovar el token de acceso sin cambiar de usuario: no debe regresar a Inicio ni borrar el formulario.
36. Mantener abierta la pantalla Convertir durante una renovación de token: debe conservarse la pantalla y la cotización válida.
37. Cambiar de la cuenta A a la B: debe volver a Inicio, limpiar los datos privados de A y cargar los de B.
38. Iniciar actualización de cuenta A, cambiar a B y provocar un error tardío en la consulta de A: no mostrar aviso de sincronización de A en B.

## Respuestas de autenticación y billetera fuera de orden
39. Abrir la aplicación y provocar que getSession responda después del evento de autenticación: la respuesta inicial no debe reemplazar la sesión ya establecida.
40. Abrir Convertir en A, iniciar consulta de saldos y cambiar a B antes de recibirla: la respuesta de A no debe mostrarse en B.
41. Solicitar dos consultas de saldos Coin/Digital con respuestas fuera de orden: solo la última debe actualizar los saldos mostrados.
42. Provocar error tardío en una consulta de saldos Coin/Digital de A tras cambiar a B: no debe aparecer un mensaje de error de A en B.

## Consultas de retiros fuera de orden
43. Iniciar dos consultas de Mis retiros y hacer que la primera responda al final: solo la segunda debe actualizar la lista.
44. Iniciar una consulta de Mis retiros en A y cambiar a B: ni la lista ni el error tardío de A deben aparecer en B.
45. Cancelar una orden ficticia mientras existe una consulta anterior pendiente: la consulta anterior no debe reemplazar el resultado de la actualización posterior.
46. Solicitar cotización Coin/Digital, modificar importe y solicitar otra: la primera petición no debe apagar el indicador de actividad de la segunda.

## Confirmación de órdenes y respuestas perdidas
47. Crear orden ficticia y cortar la respuesta de red después del registro en servidor: mostrar «Resultado de orden no confirmado», nunca afirmar que no se creó.
48. Tras el caso 47, consultar Mis retiros antes de reintentar; si es necesario repetir con el mismo importe, conservar el identificador original y verificar que no aparezcan dos órdenes.
49. Crear orden con respuesta exitosa: comprobar que la lista Mis retiros se actualiza automáticamente y contiene la nueva referencia.
50. Cambiar de cuenta mientras se crea la orden: no mostrar el resultado ni el error de la cuenta anterior en la nueva sesión.

## Resultado confirmado y fallo de actualización de lista
51. Crear una orden ficticia y provocar error únicamente en la actualización de Mis retiros: la creación debe permanecer confirmada y no mostrar «Resultado de orden no confirmado».
52. Cancelar una orden y provocar error únicamente al refrescar la lista: la cancelación debe permanecer confirmada y no mostrar «Resultado de cancelación no confirmado».
53. Perder la respuesta del RPC de cancelación: mostrar resultado no confirmado y pedir consultar Mis retiros antes de repetir.
54. Crear o cancelar y cambiar de cuenta durante la actualización secundaria: no mostrar resultados privados de la cuenta anterior.

## Actualización de saldo tras conversión
55. Confirmar conversión ficticia y lanzar después una consulta manual de saldos: si la consulta manual responde primero, la respuesta tardía de la actualización automática no debe sobrescribirla.
56. Confirmar conversión ficticia, cambiar de cuenta y recibir tarde la consulta automática: los saldos de la cuenta anterior no deben aparecer en la nueva.
57. Confirmar conversión ficticia y provocar fallo tardío en la actualización automática mientras una consulta manual más reciente ya terminó: no borrar los saldos nuevos ni mostrar una advertencia obsoleta.
