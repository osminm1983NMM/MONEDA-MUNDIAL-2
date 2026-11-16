# Prueba manual Android: recuperación segura de remesas DEMO

**Estado:** procedimiento propuesto, **no ejecutado**. Solo datos ficticios. No usar dinero real, tarjetas, cuentas bancarias ni saldos de producción.

## Requisitos previos

- Instalar un APK de pruebas generado a partir de la rama de desarrollo validada; la aprobación de GitHub Actions **no** demuestra que el APK haya sido compilado ni instalado.
- Iniciar sesión con una cuenta autorizada como `owner`; verificar que la pantalla indique `DEMO` y «Sin dinero real, sin entrega y sin débito MWD».
- Anotar la cuenta de prueba, versión del APK y hora. Evitar compartir tokens, contraseñas o datos personales.
- Para simular respuestas perdidas de forma reproducible se necesita un entorno de pruebas controlado; activar modo avión manualmente no garantiza que una RPC haya llegado al servidor.

## Casos

1. **Inicio limpio:** abrir la pantalla de remesas y verificar que no muestre una solicitud local pendiente; consultar remesas recientes sin modificar datos.
2. **Creación ficticia:** crear un borrador de monto mínimo permitido (1 USD ficticio) y confirmar que la respuesta indica `real_payments_enabled=false` y `redeemable=false`. Verificar que no haya débito de MWD.
3. **Reinicio tras creación confirmada:** cerrar completamente la app, volver a entrar y consultar el historial del servidor; comprobar que no se crea automáticamente otra orden.
4. **Creación con respuesta no confirmada:** solo mediante interrupción controlada, cerrar y reabrir la app; verificar que aparezca la misma solicitud pendiente, con el mismo monto, y que **no** se reenvíe sin tocar «Reintentar solicitud pendiente».
5. **Cambio de estado incierto:** en un entorno de prueba, provocar una respuesta no confirmada, reiniciar y comprobar que se conserva la referencia original, aparece «Reintentar cambio pendiente» y no se muestran botones de acciones incompatibles.
6. **Consulta de estado:** pulsar «Actualizar estado desde el servidor»; si el estado coincide con el destino, comprobar que la referencia original sigue pendiente hasta que una RPC de reintento confirme el identificador.
7. **Reintento idempotente:** pulsar «Reintentar cambio pendiente» una vez; confirmar en registros de pruebas que no se duplican eventos para el mismo `request_id`.
8. **Cambio de cuenta:** cerrar sesión, entrar en otra cuenta autorizada de prueba y comprobar que no se muestra la referencia local de la cuenta anterior.
9. **Almacenamiento no disponible:** con fallo controlado de AsyncStorage, verificar que se bloquean nuevas operaciones y se informa el error; no forzar nuevas solicitudes.

## Evidencias mínimas

Registrar para cada caso: resultado esperado, resultado observado, captura sin datos sensibles, identificador de orden ficticia, `request_id` si está disponible de forma segura, y estado final del servidor. Si falla un caso, detener los cambios de estado y conservar las referencias para conciliación.

## Criterio de aceptación

Ninguna operación automática al reabrir, ningún doble registro para el mismo `request_id`, separación por usuario, bloqueo ante almacenamiento defectuoso y ninguna alteración de saldos. No declarar «aprobado en Android» hasta ejecutar estos casos en un dispositivo real.
