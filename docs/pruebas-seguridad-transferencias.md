# Plan de pruebas: recuperación de transferencias y cambio de cuenta

Proyecto: Moneda Mundial 2.0 (solo créditos ficticios MWD).
Rama de trabajo: dev/recuperacion-transferencias.
Estado: PLAN PENDIENTE DE EJECUCIÓN. No afirmar que las pruebas han pasado.

## Reglas de seguridad
- Una solicitud se identifica por un UUID generado una sola vez y persistido antes de enviarla.
- Las operaciones deben vincularse al usuario autenticado en el servidor, no a un identificador enviado por el cliente.
- La repetición del mismo UUID con los mismos parámetros no debe generar un segundo descuento.
- La repetición del mismo UUID con parámetros distintos debe rechazarse.
- El cambio de cuenta no debe mostrar saldos, historial ni operaciones pendientes de la cuenta anterior.
- Un resultado tardío de la cuenta A no debe alterar el estado visual o el bloqueo de la cuenta B.
- No borrar una referencia local si la respuesta del servidor es desconocida o falla el almacenamiento.
- Las pruebas de fallos deben hacerse en un entorno de demostración aislado.

## Casos de prueba
| ID | Acción | Resultado esperado |
| --- | --- | --- |
| T01 | Iniciar sesión A, consultar saldo e historial, salir y entrar como B | No aparecen datos de A en B |
| T02 | Iniciar una transferencia ficticia en A y cambiar a B antes de la respuesta | La respuesta tardía de A no modifica el estado de B |
| T03 | Reintentar una solicitud de A con el mismo UUID y los mismos datos | Solo una operación y un descuento en la base de datos |
| T04 | Reutilizar UUID de A con diferente importe o destino | Rechazo sin cambios de saldos |
| T05 | Consultar desde B el UUID de una operación de A | No se revela la operación de A |
| T06 | Simular error de red tras enviar una operación | Conservar referencia pendiente y consultar estado antes de reintentar |
| T07 | Simular fallo de AsyncStorage antes de enviar | No ejecutar transferencia |
| T08 | Reabrir la aplicación con operación pendiente en A | Restaurar referencia de A, sin duplicar |
| T09 | Ejecutar dos solicitudes simultáneas con mismo UUID | Exactamente una transferencia contabilizada |
| T10 | Confirmar saldo total de origen y destino antes/después | Conservación del saldo total en transferencia ficticia |

## Revisión de código requerida antes de probar
1. Revisar las carreras de estado de busyRef, pendingRef y pendingUnconfirmed al cambiar de usuario.
2. Revisar la invalidación de resultados de refreshAccount y recuperación pendiente.
3. Revisar permisos EXECUTE de RPC, RLS y restricciones únicas sobre (actor_id, request_id).
4. Confirmar que las funciones SQL usan auth.uid() y transacciones atómicas.
5. Registrar resultados reales con fecha, versión/commit y evidencia, sin incluir contraseñas ni tokens.

## Registro de ejecución
Pendiente. Ningún caso se marca como aprobado hasta ejecutarse y verificarse.
