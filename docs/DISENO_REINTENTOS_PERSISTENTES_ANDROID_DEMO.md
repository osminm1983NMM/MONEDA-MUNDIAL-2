# Diseño de recuperación de reintentos tras reiniciar Android — DEMO

Fecha: 2026-11-16. Propuesta técnica, todavía no implementada.

## Contexto comprobado

- App.js utiliza AsyncStorage como almacenamiento de sesión de Supabase y dispone de session.user.id.
- RemittanceDemoScreen.js mantiene pendingCreate y pendingTransition con useRef: desaparecen al desmontar la pantalla o cerrar la app.
- La creación usa p_request_id UUID y comprueba destino HN, importe y permisos owner en el servidor.
- La transición usa p_request_id UUID y el servidor reconoce un evento anterior del mismo order_id y request_id; rechaza reutilizar el UUID con otro destino.
- El listado mwd_owner_remittances_demo devuelve órdenes recientes, pero no equivale a una consulta garantizada de una solicitud por UUID.

## Propuesta mínima segura

1. Crear un pequeño módulo de almacenamiento local con claves versionadas y delimitadas por el user.id autenticado; nunca usar una clave global compartida entre cuentas.
2. Guardar antes de la llamada RPC una única intención pendiente por tipo: {version:1, userId, kind:'create'|'transition', requestId, orderId?, destination:'HN'?, cents?, next?, createdAt}. No almacenar contraseñas, códigos de retiro ni secretos.
3. Validar al leer: versión, UUID, país, importe entero seguro, transición permitida y correspondencia estricta con el usuario autenticado. Ante datos inválidos, bloquear la creación de una referencia nueva y mostrar recuperación asistida.
4. Si hay intención pendiente, mostrar primero «Reintentar la misma solicitud» con idéntico requestId y parámetros; no generar otro UUID.
5. Eliminar la intención solo tras recibir una respuesta segura con los indicadores real_payments_enabled=false y redeemable=false y datos coherentes; no eliminarla por un error de red.
6. En cierre de sesión o cambio de cuenta, impedir que otra cuenta reintente una intención ajena; definir una política explícita de limpieza sin perder referencias pendientes de la cuenta original.
7. Para la recuperación de una creación cuyo UUID se perdió, el listado de recientes solo sirve como conciliación manual: no permite asegurar que una orden ausente nunca se creó. Una consulta server-side por requestId, con autorización owner y sin efectos secundarios, sería más fiable antes de cualquier operación financiera real.

## Riesgos y pruebas previas

- AsyncStorage no es un almacén cifrado por defecto; no guardar credenciales, tokens de retiro ni PII. Considerar almacenamiento protegido si los datos futuros lo requieren.
- La escritura local puede fallar o quedar interrumpida. Si falla antes de RPC, NO enviar RPC sin una estrategia de recuperación documentada.
- Una respuesta RPC puede llegar después del cambio de usuario: validar sesión/propietario antes de actualizar la interfaz.
- Ensayar: reinicio antes de RPC, después de commit y antes de respuesta, sesión caducada, logout/login, dos cuentas, datos locales corruptos, error de almacenamiento, reintento doble y nueva instalación sin almacenamiento.
- Verificar que ninguna prueba modifica saldos existentes ni opera con dinero real.

## Decisión de implementación

No desplegar todavía persistencia ni una RPC adicional sin pruebas de contrato, de aislamiento entre cuentas y de recuperación tras fallos. La advertencia actual en pantalla es una mitigación temporal, no una solución completa.
