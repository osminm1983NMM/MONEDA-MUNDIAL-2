# Auditoría de permisos RPC: remesas ficticias US → HN

Fecha: 2026-11-16. Inspección de solo lectura de privilegios y definiciones SQL.

| Función | anon EXECUTE | authenticated EXECUTE | SECURITY DEFINER |
| --- | --- | --- | --- |
| mwd_owner_remittance_create_demo | No | Sí | Sí |
| mwd_owner_remittance_transition_demo | No | Sí | Sí |
| mwd_owner_remittances_demo | No | Sí | Sí |

Las tres llaman al control interno assert_owner(), que comprueba auth.uid() y rol owner en public.mwd_admin_roles. EXECUTE para authenticated no significa autorización para cualquier usuario: la comprobación interna es imprescindible.

La creación usa ON CONFLICT (created_by, request_id) DO NOTHING, compara importe y destino al reintentar, y devuelve real_payments_enabled=false. La consulta verifica el rol owner y limita el historial a 100 órdenes. La transición utiliza FOR UPDATE e idempotencia de eventos.

Pendiente: probar usuario anónimo, autenticado sin rol y propietario en laboratorio aislado; probar concurrencia e inspeccionar eventos. Esta revisión no sustituye pruebas de integración ni auditoría de todos los RPC SECURITY DEFINER.

No se modificaron datos, permisos, saldos ni funciones.