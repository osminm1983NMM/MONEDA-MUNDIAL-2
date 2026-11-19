# Revisión integral adicional — 2026-11-19

## Trabajo aplicado
- Reparadas dos aserciones obsoletas en `tests/security-static.test.cjs` para reflejar el nuevo bloqueo `recoveringRef` y `pendingStorageError`; commit `e02d51c`.
- Confirmado en código remoto que el bloqueo de cierre de sesión, el reinicio de estado por cuenta, el bloqueo de recuperación, el bloqueo de reintento y la persistencia de identificador antes de RPC siguen presentes.
- **No se ejecutó la batería Node**: no existe acceso de red desde el entorno de ejecución al repositorio GitHub y no se descargó una copia de trabajo. Verificar `node --test tests/security-static.test.cjs` en entorno con checkout antes de dar por aprobadas las pruebas.

## Auditoría SQL de funciones comerciales (lectura)
Se inspeccionaron los cuerpos actuales de:
- `mwd_cancel_payment_request_demo`: exige sesión y `merchant_user_id=auth.uid()`, bloquea fila y no permite cancelar un pago ya realizado.
- `mwd_get_payment_request_demo`: exige sesión; permite consultar solicitudes pendientes para que un pagador pueda verlas o solicitudes propias del comercio. Revisar si la visibilidad de cualquier solicitud pendiente por UUID coincide con el modelo de privacidad.
- `mwd_pay_merchant_demo`: exige sesión, bloquea solicitud, rechaza autopago y moneda distinta de MWD, reutiliza ID de pago para la transferencia y distingue pago ya registrado.
- `mwd_conversion_confirm_demo`: exige sesión, selecciona cotización del usuario, bloquea saldos, comprueba vencimiento, liquidez, límites y estado ejecutado; inserta asientos de conversión en transacción PostgreSQL.

## Limitaciones
La inspección de código **no** demuestra que estos controles resistan concurrencia, interrupciones de red o identidades maliciosas; requiere pruebas autenticadas controladas. Tampoco es aprobación para pagos reales.

## Próxima ejecución necesaria
1. Ejecutar suite Node en checkout y reparar cualquier fallo real.
2. Pruebas A/B sobre entorno de demostración: solicitudes repetidas, carreras de pago/cancelación, cotización vencida, recuperación y sesiones cruzadas.
3. Compilar APK y verificar flujos en Android.
4. Cerrar avisos de seguridad Auth y revisar todas las RPC restantes.
