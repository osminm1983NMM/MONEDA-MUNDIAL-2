# Plan de pruebas — recuperación de operaciones MWD (LAB)

**Alcance:** solo créditos ficticios. No usar dinero real. No modificar `main` ni saldos de producción.

## Antes de probar
- Confirmar que la APK instalada dice **Moneda Mundial 2.0 LAB** y que su paquete Android es `com.monedamundial.app.recoverylab`.
- Verificar que la compilación corresponde al commit `df215aa7` de `dev/recuperacion-transferencias`.
- Usar dos cuentas de demostración conocidas y registrar sus saldos iniciales.
- Si aparece una operación pendiente real en el laboratorio, no borrar el almacenamiento ni reinstalar hasta resolverla.

## Casos (ejecutar solo con autorización y saldos ficticios)
1. **Inicio limpio:** abrir LAB; esperar que termine «Verificando operaciones pendientes». Confirmar que no hay alerta de almacenamiento.
2. **Transferencia normal:** enviar un importe ficticio pequeño entre cuentas de prueba. Confirmar operación única, historial y saldos coherentes.
3. **Cierre durante transferencia:** simular una interrupción controlada; reabrir la misma cuenta y comprobar que la referencia pendiente reaparece y que se bloquean nuevos envíos.
4. **Consulta de estado:** pulsar «Verificar operación pendiente». Si figura procesada, confirmar una sola operación; si figura sin confirmar, conservar la referencia.
5. **Reintento:** únicamente tras estado «unconfirmed», usar «Reintentar misma solicitud» y confirmar que reutiliza el mismo UUID; verificar que no hay doble débito.
6. **Cambio de cuenta:** con una operación pendiente de la cuenta A, cerrar sesión e ingresar a B. No debe mostrarse el pendiente de A ni su saldo en B. Al volver a A, debe recuperar su propia referencia.
7. **Conexión fallida:** sin red, la aplicación debe conservar el pendiente y evitar una nueva transferencia; al volver la red, consultar estado.
8. **Aportación ficticia:** verificar que usa las mismas restricciones de pendiente.

## Criterios de aceptación
- Una sola operación en `mwd_operations` por `(actor_id, request_id)`.
- Ningún doble débito y ningún saldo negativo.
- Ninguna mezcla de datos entre cuentas.
- Nunca borrar una referencia por un error de red o estado desconocido.
- Registrar capturas y errores antes de considerar la APK aprobada.

## Riesgo pendiente de revisar
La implementación actual requiere auditoría adicional del manejo de errores después de escribir o borrar AsyncStorage y de la forma exacta de la respuesta RPC. Una compilación exitosa **no** prueba estas propiedades.
