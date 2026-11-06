# Plan de verificación: recuperación de conversiones ficticias

Rama: `fix/swap-confirmation-recovery`. Solo entorno DEMO; no dinero real.

## Evidencia revisada (2026-11-06)
- RPC `mwd_conversion_confirm_demo`: identifica al usuario con `auth.uid()`, bloquea la cotización con `FOR UPDATE`, responde `already_processed` si ya se ejecutó y rechaza una cotización vencida sin ejecutar.
- `mwd_swap_private.demo_conversions.quote_id` tiene restricción `UNIQUE`.
- `mwd_swap_private.demo_quotes` tiene `UNIQUE(user_id,client_request_id)`.
- El cliente distingue confirmación exitosa de un fallo posterior al refrescar saldos.

## Pruebas pendientes antes de fusionar
- [ ] Cotización válida: confirmar una vez; verificar saldos y asiento.
- [ ] Reintentar la misma cotización ejecutada: esperar `already_processed`, sin segundo asiento ni movimiento adicional.
- [ ] Cotización vencida sin ejecutar: esperar rechazo sin movimientos.
- [ ] Simular caída de red **después** de que el servidor confirme: reintentar la misma cotización y comprobar un solo movimiento.
- [ ] Simular fallo **solo** al consultar saldos después de una confirmación exitosa: mostrar «Conversión registrada» y permitir «Consultar saldos».
- [ ] Intentar confirmar una cotización de otro usuario: esperar rechazo.
- [ ] Confirmaciones concurrentes de la misma cotización: una sola conversión.
- [ ] Verificar que los mensajes no prometan dinero real y que el balance no se duplique.

## Criterio de aceptación
No fusionar a `main` ni generar APK de reemplazo hasta ejecutar las pruebas pertinentes y revisar los resultados. No realizar pruebas destructivas en producción.

## Pruebas adicionales: transferencias y aportaciones ficticias
- [ ] Confirmar una transferencia y verificar un solo débito, un solo crédito y un asiento.
- [ ] Reintentar con el mismo `p_request_id` después de perder la respuesta: no duplicar el movimiento.
- [ ] Simular fallo en `refreshAccount()` tras una respuesta `ok`: mostrar «Operación registrada», nunca «Resultado pendiente».
- [ ] Simular fallo antes de recibir confirmación: conservar `pendingRef.current.id` y los datos originales para reintento.
- [ ] Cambiar importe o destinatario después de un resultado incierto: advertir al usuario que primero verifique la operación anterior (mejora de seguridad pendiente).
