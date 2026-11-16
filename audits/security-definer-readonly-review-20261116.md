# Revisión de funciones privilegiadas (solo lectura)

Fecha: 2026-11-16. Proyecto Supabase: Moneda Mundial DEMO. Ningún SQL de escritura ejecutado.

## Inventario confirmado por catálogos PostgreSQL

- 57 funciones `SECURITY DEFINER` en esquema `public`.
- 0 permiten `EXECUTE` a rol `anon`.
- 56 permiten `EXECUTE` a rol `authenticated`.
- Las 56 contienen referencias textuales a `auth.uid()` o `assert_owner`; esta búsqueda es heurística y NO prueba autorización correcta.
- Las 38 funciones `mwd_owner_*` revisadas en catálogo contienen referencias a `mwd_admin_roles` o `assert_owner`. Una coincidencia textual no sustituye revisión semántica ni pruebas negativas.
- `mwd_admin_roles`: RLS activo; `authenticated` puede SELECT, no INSERT/UPDATE/DELETE. Política SELECT limita lectura a `auth.uid() = user_id`.
- Se inspeccionaron las definiciones de `mwd_owner_summary_demo`, `mwd_owner_update_demo_fee`, `mwd_owner_partner_save_demo`, `mwd_owner_remittance_create_demo`, y `assert_owner()` en dos esquemas privados: todas contienen comprobación de propietario.

## Limitaciones y próximas verificaciones

1. Ejecutar pruebas negativas con identidades sintéticas en PostgreSQL efímero, no en Supabase principal.
2. Revisar semánticamente cada función privilegiada y sus dependencias, no solo expresiones regulares.
3. Evaluar hallazgos del asesor de seguridad de Supabase por gravedad, exposición y permisos.
4. No habilitar dinero real sin revisión independiente de seguridad, licencias, KYC/AML y proveedores regulados.

No se modificaron políticas, roles, funciones ni saldos del proyecto Supabase.

## Revisión adicional de funciones sensibles

- `mwd_owner_agent_access_demo`: exige `mwd_partners_private.assert_owner()` antes de validar asignaciones, exige motivo de 10–200 caracteres y registra auditoría; resultado indica `readOnly=true`, `canViewOrders=false`, `canSimulatePickup=false`.
- `mwd_owner_conversion_policy_demo`: exige `assert_owner()`, limita tasa y comisión, exige motivo y marca temporal esperada para evitar sobrescritura concurrente; registra cambios en auditoría y devuelve `realPaymentsEnabled=false`.
- Ambas son `SECURITY DEFINER`: deben mantenerse bajo revisión semántica y pruebas negativas específicas, sin invocarlas sobre datos principales.
- La prueba `tests/postgres-owner-access-negative.sql` se ejecutó correctamente en GitHub Actions `43889803029`, junto con la integración PostgreSQL aislada.

## Remesas y entrega ficticia: revisión de código (solo lectura)

- `mwd_owner_remittance_transition_demo`: exige `mwd_remittance_demo_private.assert_owner()`, acepta únicamente `review`, `simulated`, `cancelled`; transiciones desde `draft` a `review/cancelled` y desde `review` a `simulated/cancelled`; controla reintentos por `request_id` y marca `real_payments_enabled=false`.
- `mwd_owner_try_pickup_code_demo`: exige propietario; usa `FOR UPDATE` sobre muestra para serializar intentos; compara huellas de solicitudes repetidas; expira el código; bloquea tras cinco errores; exige revisión de identidad simulada antes de consumir; no registra pago real ni cambia libro contable.
- `mwd_owner_complete_payout_sample_demo`: exige propietario; bloquea orden y asignación; requiere orden `simulated`, asignación `planned`, código `consumed`, `identity_check_simulated_at` y evento `consumed`; respuesta indica `money_paid=false`, `real_payments_enabled=false`.

### Pruebas aún pendientes

- Reproducir definiciones y dependencias exactas en PostgreSQL efímero y ejecutar casos negativos, reintentos y concurrencia.
- Verificar constraints e índices únicos sobre `request_id`, transiciones y eventos.
- Probar de forma aislada que un usuario no propietario no puede consultar datos sensibles ni finalizar entregas.
- No inferir preparación para pagos reales a partir de estas funciones DEMO.

## Índices de unicidad del flujo de retiro (consulta directa de catálogos)

Se verificaron en `mwd_remittance_demo_private` las siguientes garantías físicas:

- `orders(created_by,request_id)` UNIQUE: alta idempotente por creador.
- `events(order_id,request_id)` UNIQUE y `events(order_id)` UNIQUE parcial `to_status='simulated'`: evita eventos repetidos y más de una finalización simulada por orden.
- `payout_assignments(order_id)` UNIQUE, `assignment_request_id` UNIQUE y `sample_request_id` UNIQUE: asignación única por orden y claves de reintento.
- `payout_events(assignment_id,event_type)` UNIQUE y `payout_events(request_id)` UNIQUE: evita duplicar eventos de entrega.
- `pickup_code_attempts(sample_id,request_id)` UNIQUE: evita repetir un intento con la misma clave.
- `pickup_code_samples(assignment_id)` UNIQUE, `consume_request_id` UNIQUE, `issue_request_id` UNIQUE, `identity_check_request_id` UNIQUE, `token_sha256` UNIQUE: unicidad de muestra, solicitudes y token.

Estos índices son barreras de integridad, no pruebas suficientes de autorización ni de concurrencia completa. La prueba de modelo de retiro en GitHub Actions run 43890357551 terminó `success`. No se modificaron índices de Supabase.

## Restricciones CHECK del retiro (verificación en catálogo real, solo lectura)

- `orders`: monto de demostración de 100 a 10 000 000 centavos, origen `US`, estados permitidos `draft/review/simulated/cancelled`.
- `payout_assignments`: `planned` exige `simulated_at` y `sample_request_id` nulos; `sample_completed` exige ambos no nulos.
- `pickup_code_samples`: vencimiento posterior a creación, estado activo sin cierre, estados cerrados con `closed_at`, estado `consumed` requiere `consume_request_id`, máximo cinco intentos fallidos, estados restringidos, token SHA-256 hexadecimal de 64 caracteres.
- `pickup_code_attempts`: huella hexadecimal de 64 caracteres cuando existe.

**Limitación:** restricciones CHECK e índices protegen la consistencia de datos, pero no sustituyen revisión de permisos, flujos de error, ni pruebas sobre funciones reales. Consulta sin cambios en Supabase.

## Auditoría de permisos de tablas privadas de remesas

Consulta directa a `pg_class` y `has_table_privilege` en Supabase principal, solo lectura: las siete tablas `mwd_remittance_demo_private.events`, `orders`, `payout_assignments`, `payout_events`, `pickup_code_attempts`, `pickup_code_events`, `pickup_code_samples` tienen RLS habilitada (`relrowsecurity=true`). El rol `anon` no tiene SELECT y el rol `authenticated` no tiene SELECT, INSERT, UPDATE ni DELETE sobre ninguna de ellas. Estas restricciones protegen acceso directo; las funciones `SECURITY DEFINER` deben seguir auditándose porque pueden operar con privilegios elevados.

## Auditoría de superficie de funciones de retiro

Consulta a `pg_proc`/`has_function_privilege`: 15 funciones `public.mwd_owner_*` con nombres relacionados con remesas, payout y pickup: todas `anon_exec=false`, `authenticated_exec=true`, y todas contienen la llamada o texto `assert_owner` en su definición. Es una revisión de superficie, no una prueba dinámica de autorización.

Revisión directa de cuerpos:
- `mwd_owner_cancel_pickup_code_demo` llama a `mwd_remittance_demo_private.assert_owner()` al comenzar, bloquea fila con `FOR UPDATE`, solo cancela códigos activos y registra evento; no permite cancelar códigos cerrados.
- `mwd_owner_issue_pickup_code_demo` llama a `assert_owner()`, bloquea orden/asignación/código; exige orden `simulated` y asignación `planned`; el reintento con el mismo UUID devuelve `code=NOT_REISSUED` y no vuelve a exponer el secreto.
- `mwd_owner_pickup_simulate_demo` usa **otro subsistema** `mwd_pickup_private` y `mwd_partners_private.assert_owner()`; limita intentos incorrectos recientes a cinco en quince minutos. No debe confundirse con el flujo `mwd_remittance_demo_private` de códigos `DEMO-`.

**Próximo trabajo:** inventariar diferencias de los dos subsistemas de retiro y evitar que la interfaz los trate como un mismo flujo; verificar íntegramente los cuerpos y los permisos de funciones dependientes. No se modificó Supabase.
