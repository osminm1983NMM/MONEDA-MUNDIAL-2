# Auditoría de funciones administrativas de remesas DEMO

Fecha: 2026-11-16. Revisión de solo lectura de pg_proc y pg_get_functiondef en Supabase.

## Hallazgos

Se identificaron 12 funciones públicas SECURITY DEFINER relacionadas con remesas, pagos simulados y códigos de retiro. En las 12, el rol anon no tiene EXECUTE; authenticated sí tiene EXECUTE y el texto de cada definición contiene una llamada a mwd_remittance_demo_private.assert_owner().

Funciones revisadas:
- mwd_owner_assign_payout_design_demo
- mwd_owner_cancel_pickup_code_demo
- mwd_owner_complete_payout_sample_demo
- mwd_owner_issue_pickup_code_demo
- mwd_owner_payout_design_summary_demo
- mwd_owner_pickup_code_summary_demo
- mwd_owner_remittance_create_demo
- mwd_owner_remittance_events_demo
- mwd_owner_remittance_monitor_demo
- mwd_owner_remittance_transition_demo
- mwd_owner_remittances_demo
- mwd_owner_try_pickup_code_demo

Diez definiciones incluyen la cadena real_payments_enabled; las funciones de listado mwd_owner_remittance_events_demo y mwd_owner_remittances_demo no incluyen esa cadena. La ausencia de una bandera en un listado no demuestra por sí misma un defecto, pero merece revisión del contrato de respuesta.

La búsqueda textual de FOR UPDATE depende de mayúsculas y minúsculas y no demuestra ausencia de bloqueos. Es necesaria una inspección semántica de las operaciones críticas.

## Límites y pendientes

La presencia de assert_owner en el código fuente no demuestra que todas las rutas de ejecución lo invoquen antes de acceder a datos; revisar cada función y ejecutar pruebas con sesiones de laboratorio. No se auditaron funciones fuera de este conjunto ni se realizaron pruebas activas. No se modificaron datos, saldos, permisos o funciones.