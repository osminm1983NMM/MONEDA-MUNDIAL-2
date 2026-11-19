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
