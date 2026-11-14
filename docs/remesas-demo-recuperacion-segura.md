# Diseño de recuperación segura de remesas DEMO

Estado: diseño, **no implementado**. No habilitar dinero real.

## Situación comprobada
- Tabla privada `mwd_remittance_demo_private.orders`: `id`, `created_by`, `request_id`, `source_country`, `destination_country`, `amount_cents`, `status`, `created_at`, `updated_at`.
- Al inspeccionar la tabla había 0 órdenes.
- La pantalla actual mantiene la orden y los identificadores de reintento en memoria: al cerrar la app se pierden.

## Recuperación propuesta
1. El cliente identifica al usuario autenticado mediante `supabase.auth.getUser()`.
2. Antes de iniciar una creación, guarda localmente un registro mínimo por usuario con `request_id`, monto y país, sin datos sensibles de beneficiarios. Evitar compartir entre cuentas del mismo teléfono.
3. La creación y la transición utilizan el mismo `request_id` cuando se reintenta una petición cuyo resultado es incierto.
4. Un RPC **solo lectura** de servidor, restringido al propietario mediante comprobación de identidad/rol en el servidor, consulta la orden por `request_id` y devuelve solo sus campos necesarios. Nunca conceder SELECT directo a tablas privadas.
5. Al iniciar la pantalla, el cliente consulta primero el servidor. Si encuentra la orden, la muestra y borra el intento local resuelto; si no la encuentra, ofrece reintentar con el mismo identificador.
6. Para transiciones, persistir `order_id`, destino de estado y `request_id` antes del RPC; al recuperar, consultar el estado remoto y reconciliar antes de permitir una acción diferente.
7. En cierre de sesión o cambio de cuenta, no mostrar datos locales de otra identidad. Los registros se deben particionar por `auth.uid()` y limpiarse cuando proceda.
8. En errores de almacenamiento o de red, bloquear operaciones nuevas que puedan duplicar solicitudes hasta resolver la incertidumbre.

## Seguridad y pruebas
- Verificar permisos del RPC con usuario propietario, usuario no propietario y sesión anónima.
- No confiar en `user_metadata` ni en roles enviados por el cliente.
- Evitar `SECURITY DEFINER` sin validación explícita de `auth.uid()`, rol, búsqueda segura y permisos de ejecución limitados.
- Simular pérdida de red justo después de crear y después de transicionar; reiniciar la app; confirmar que no se duplica la orden.
- No cambiar `main`, no tocar saldos MWD ni ejecutar pagos reales.
- Antes de implementar un RPC nuevo, revisar las funciones existentes, políticas y documentación vigente de Supabase.
