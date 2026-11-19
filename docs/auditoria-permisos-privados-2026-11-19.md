# Auditoría de permisos — 2026-11-19

Inspección SQL de solo lectura en Supabase `egrsdrlpavrtbgxoyxvg`; no se modificaron permisos, datos ni infraestructura.

## Comprobaciones efectuadas

- Inspeccionado el cuerpo de `mwd_partners_private.assert_owner()`: exige `auth.uid()` y una fila `mwd_admin_roles` con `role='owner'`.
- Inspeccionadas funciones `mwd_owner_summary_demo`, `mwd_owner_accounting_alerts_demo`, `mwd_owner_agent_access_demo`, `mwd_owner_update_demo_fee` y `mwd_owner_conversion_policy_demo`: comprueban propietario directamente o por `assert_owner()`.
- Consultados permisos SQL de **20 tablas** de `mwd_agents_private`, `mwd_finance_private`, `mwd_partners_private`, `mwd_swap_private`: `anon` sin SELECT; `authenticated` sin SELECT, INSERT ni UPDATE en todas las inspeccionadas.

## Limitaciones

- No se revisaron todos los esquemas privados ni las 56 RPC privilegiadas del asesor.
- No se ha probado una llamada autenticada como propietario y como usuario normal.
- La ausencia de permisos directos de tabla no demuestra que cada función `SECURITY DEFINER` esté protegida; auditar cada punto de entrada.
- El aviso de protección de contraseñas filtradas sigue pendiente.

## Siguiente prueba

Revisar las RPC de transferencias y roles bajo identidades de prueba separadas, sin dinero real. Ejecutar test de concurrencia e interrupción de red solo con un protocolo de recuperación y registro de resultados.
