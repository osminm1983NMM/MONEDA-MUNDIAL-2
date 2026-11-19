# Pruebas manuales de recuperación de operaciones DEMO

Este plan no habilita pagos reales. Ejecutar solo con cuentas y créditos ficticios.

## Precondiciones
- Instalar una compilación de la rama de desarrollo, nunca asumir que la app publicada contiene estos cambios.
- Iniciar sesión con una cuenta de prueba y registrar saldo e historial iniciales.
- Confirmar que las RPC `mwd_operation_status_demo`, `mwd_transfer_demo` y `mwd_contribute_demo` están disponibles.
- No probar con dinero real ni con órdenes de terceros.

## Casos
1. **Transferencia normal**: enviar una cantidad pequeña a otra cuenta de prueba. Verificar exactamente una operación y un débito/crédito.
2. **Aportación normal**: aportar una cantidad pequeña. Verificar una operación y un solo débito.
3. **Respuesta perdida**: interrumpir la red después del envío, recuperar conexión y repetir exactamente los mismos datos. Verificar que la referencia guardada se reutiliza y que no existe doble cargo.
4. **Reinicio Android**: interrumpir el proceso, cerrar por completo la aplicación, reabrir con la misma cuenta e introducir los mismos datos. Verificar que la consulta de estado recupera la operación sin duplicarla.
5. **Datos distintos con operación pendiente**: después de una interrupción, intentar otro importe o destinatario. Debe bloquearse hasta resolver la referencia pendiente.
6. **Cambio de cuenta**: iniciar sesión con otra cuenta de prueba. No debe reutilizar la referencia del usuario anterior.
7. **Respuesta del servidor no coincidente**: simular respuesta `processed` con importe, tipo o destinatario distinto. Debe detenerse y requerir revisión.
8. **Almacenamiento inaccesible**: simular fallo de AsyncStorage antes del envío. No debe enviarse una operación sin guardar primero la referencia.
9. **Sin conexión al consultar estado**: comprobar que el reintento utiliza el mismo UUID y que el servidor mantiene idempotencia.
10. **Historial de retiros**: verificar que muestra la moneda recibida de Supabase, sin confundir USD de referencia con MWD ficticios.


11. **Fallo de consulta previa**: forzar error en `mwd_operation_status_demo`. Verificar que no se llama a `mwd_transfer_demo` ni `mwd_contribute_demo`, y que el UUID local se conserva.
12. **Respuesta previa inesperada**: devolver un estado distinto de `processed` o `unconfirmed`. Debe bloquear el envío.
13. **Operación confirmada con error de almacenamiento local**: simular fallo de `AsyncStorage.removeItem`. Verificar que se informa la confirmación y que un reintento con el mismo UUID no duplica la operación.
14. **Retiro creado con respuesta perdida**: repetir el importe después de reiniciar Android. Verificar una sola orden y que el código secreto no se expone nuevamente.


15. **Reinicio con borrador pendiente**: reiniciar Android después de guardar la referencia; comprobar que se abre la pantalla correcta con importe y destinatario originales, sin ejecutar RPC de envío automáticamente.
16. **Cierre de sesión y cambio de usuario**: comprobar que el borrador de una cuenta no aparece en otra y que no se envían solicitudes durante la restauración.
17. **Datos locales dañados**: introducir JSON inválido en almacenamiento de pruebas; comprobar bloqueo y aviso, sin envío.
18. **Fallo de consulta previa con red caída**: comprobar que el sistema no intenta enviar transferencias/aportaciones si falla la RPC de estado.

19. **Reinicio con retiro pendiente**: guardar una solicitud de retiro, cerrar Android y abrir de nuevo. Debe restaurar el importe y mostrar la pantalla de retiros cuando no hay transferencia pendiente; no debe crear la orden automáticamente.
20. **Ambos borradores pendientes**: verificar que la recuperación del retiro no sustituye la pantalla de una transferencia pendiente; el usuario debe poder revisar cada solicitud por separado.
21. **Código secreto de retiro**: tras una respuesta perdida, el servidor devuelve `already_created` y `pickupCode: null`. La app debe explicar que el código no se puede recuperar, sin inventarlo ni crear otra orden.

22. **Carrera de restauración**: guardar a la vez una transferencia y un retiro pendientes. Reiniciar repetidamente y verificar que la pantalla de transferencia mantiene prioridad, independientemente del tiempo de respuesta de AsyncStorage.
23. **Datos de destinatario dañados**: recuperar transferencia con código distinto de `MWD-` más 16 caracteres hexadecimales; la app debe avisar y no enviar.
24. **Aportación con destinatario no vacío**: recuperar borrador de aportación manipulado; debe rechazarse.

25. **Cambio de usuario con retiro cargado**: abrir la lista de retiros de la cuenta A, cerrar sesión e iniciar con B. Deben borrarse los datos de retiro de A antes de consultar los de B.
26. **Confirmación remota y fallo de limpieza local**: simular `processed` y fallo de `AsyncStorage.removeItem`; comprobar que la app reconoce la operación confirmada, no vuelve a enviar y muestra aviso de registro local pendiente.

27. **Respuesta perdida y saldo ya debitado**: simular transferencia procesada cuyo saldo disponible es inferior al importe original. Confirmar que se puede consultar el UUID pendiente y que no se ejecuta un segundo débito.
28. **Nuevo envío sin saldo**: sin solicitud pendiente, verificar que se mantiene el bloqueo por saldo insuficiente.
29. **Doble pulsación de retiro**: pulsar dos veces rápidamente Crear orden ficticia y comprobar una sola invocación a la RPC de creación desde la interfaz.

## Criterios de aprobación
- Ninguna operación duplicada por reintento o reinicio.
- Ninguna operación nueva con una referencia pendiente de datos distintos.
- Saldo y libro contable coherentes tras cada prueba.
- Los mensajes de interfaz nunca indican pagos reales.
- Documentar capturas y resultados antes de fusionar con `main`.

## Límites conocidos
- Solo se almacena una operación pendiente por usuario y dispositivo; no resuelve sincronización de pendientes entre dispositivos.
- Si el almacenamiento local se pierde, el usuario puede necesitar reconciliación manual.
- Los escenarios de concurrencia necesitan ejecución controlada; revisar código no equivale a haberlos probado.
