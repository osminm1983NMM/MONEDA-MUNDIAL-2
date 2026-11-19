# Auditoría de avisos Supabase — 2026-11-19

Proyecto: `egrsdrlpavrtbgxoyxvg`. Auditoría **de solo lectura**, sin cambios en políticas, funciones ni datos.

## Avisos de seguridad del asesor Supabase

| Aviso | Nivel | Cantidad | Interpretación |
| --- | --- | ---: | --- |
| `rls_enabled_no_policy` | INFO | 30 | Tablas privadas con RLS habilitada sin políticas. En este diseño puede ser intencional: acceso solo mediante funciones autorizadas. No agregar políticas amplias para silenciar el aviso. |
| `authenticated_security_definer_function_executable` | WARN | 56 | Funciones `SECURITY DEFINER` invocables por usuarios autenticados. Revisar autorización interna, validación de `auth.uid()`, propiedad de datos, `search_path`, idempotencia y permisos antes de cambios. |
| `auth_leaked_password_protection` | WARN | 1 | Protección contra contraseñas comprometidas no habilitada en Auth. Evaluar activación en la configuración del proyecto. |

Remediaciones oficiales:
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Avisos de rendimiento

| Aviso | Nivel | Cantidad | Decisión |
| --- | --- | ---: | --- |
| `unindexed_foreign_keys` | INFO | 24 | Evaluar uso y planes de consultas antes de crear índices. |
| `unused_index` | INFO | 17 | No borrar índices sin métricas de uso representativas. |

## Condiciones para cierre

1. Auditar el cuerpo y permisos de cada una de las 56 funciones privilegiadas expuestas; no asumir vulnerabilidad solo por el aviso.
2. Confirmar que cada función valida identidad, titularidad, rol y estado de operación según corresponda.
3. Confirmar que `anon` no puede ejecutar RPC privadas y que las tablas privadas no son accesibles directamente.
4. Verificar la configuración de protección contra contraseñas filtradas y decidir su activación con autorización.
5. No alterar tablas, permisos o índices de producción para eliminar avisos sin análisis de impacto.
6. Completar APK instalada y pruebas de dos cuentas antes de dar por cerrada la demo Android.

**Conclusión:** la exportación Android no sustituye una auditoría de autorización del backend ni pruebas reales de instalación.

## Verificación SQL de permisos (solo lectura)

Consulta de catálogo `pg_proc` y `pg_namespace` sobre las funciones `public.mwd_%` con `SECURITY DEFINER` ejecutables por `authenticated`:

- Total: **56**.
- Sin permiso `EXECUTE` para `anon`: **56 de 56**.
- Con configuración explícita de `search_path`: **56 de 56**.
- Con referencia textual directa a `auth.uid()`: **21 de 56**.
- Con referencia textual a posibles funciones auxiliares de roles/propietario/alcance: **40 de 56**.

**Precaución:** los dos últimos conteos son búsquedas de texto en el cuerpo SQL, se superponen y **no son pruebas de autorización efectiva**. Una función puede delegar comprobaciones en auxiliares o tener una condición incorrecta. Los 56 procedimientos requieren revisión semántica de sus rutas de acceso, especialmente funciones `mwd_owner_%`, transferencias, retiros y conversiones.

El catálogo confirmó asimismo que `public.mwd_handle_new_user()` no concede `EXECUTE` ni a `anon` ni a `authenticated`; no forma parte de los 56 avisos.

**Acción:** conservar permisos actuales; no conceder acceso directo a tablas privadas. Siguiente fase: inspección de cuerpos y dependencias de funciones críticas, seguida de pruebas negativas con usuarios de distintos roles.

## Revisión semántica de cuatro RPC críticas (solo lectura)

Se inspeccionó el texto SQL de las funciones en el catálogo de Postgres:

| Función | Controles observados | Verificación pendiente |
| --- | --- | --- |
| `public.mwd_transfer_demo` | `auth.uid()` obligatorio, destinatario distinto del remitente, bloqueo de las dos billeteras en orden, validación de saldo y solicitud idempotente por actor | Dos usuarios concurrentes, errores de red, límites de saldo, aislamiento de historial |
| `public.mwd_pickup_create_demo` | Identidad requerida, validación de monto y país, bloqueo por usuario, máximo cinco órdenes por hora, identificador idempotente y código almacenado como SHA-256 | Simulación concurrente y reintentos tras respuesta perdida |
| `public.mwd_pickup_cancel_demo` | Filtra la orden por `sender_user_id=auth.uid()`, bloquea la fila, solo cancela pendientes y permite repetir cancelación | Denegación con cuenta ajena y estados terminales |
| `public.mwd_owner_partner_save_demo` | Llama a `mwd_partners_private.assert_owner()` antes de crear/editar, valida campos y restringe estados editables | Prueba negativa con usuario sin rol propietario |

La función auxiliar `mwd_partners_private.assert_owner()` exige `auth.uid()` no nulo y un registro `public.mwd_admin_roles` con `role='owner'`. Es un control del servidor, no solo de la interfaz.

**Alcance:** inspección estática de código SQL; no se invocaron RPC de escritura ni se alteraron saldos, órdenes o socios. Estas cinco funciones fueron revisadas, pero **no declaradas aprobadas mediante pruebas dinámicas**. Las otras funciones privilegiadas siguen pendientes de revisión semántica.

## Barrido de autorización administrativa

Consulta de solo lectura del catálogo `pg_proc`:

- **38** RPC `public.mwd_owner_%` con permiso `EXECUTE` para `authenticated`.
- **38 de 38** contienen referencia textual a `assert_owner()` o una comparación explícita con `role='owner'`.
- **0** funciones `mwd_owner_%` sin coincidencia en ese patrón.

Inspección adicional de cuerpos:
- `mwd_owner_summary_demo()`: verifica `auth.uid()` y `mwd_admin_roles.role='owner'` antes de consultar estadísticas.
- `mwd_owner_demo_fee_catalog()`: verifica identidad y rol propietario antes de mostrar tarifas.
- `mwd_owner_update_demo_fee(...)`: verifica identidad y rol propietario, limita los valores de comisión, bloquea la fila y restringe actualizaciones a rutas ficticias con `real_payments_enabled=false`.
- `mwd_agent_my_scope_demo()`: filtra asignaciones por `a.user_id=auth.uid()`, estado activo y vencimiento.

**Limitación:** la coincidencia textual 38/38 no equivale a prueba de resistencia ante ataques ni sustituye las pruebas negativas con usuarios reales de demostración. No se ejecutaron funciones de escritura.

## Comprobación de privilegios directos en tablas privadas

Consulta de solo lectura sobre `pg_class`/`pg_namespace` y `has_table_privilege` para las tablas ordinarias/particionadas de los esquemas `mwd_%private`:

| Comprobación | Resultado |
| --- | ---: |
| Tablas privadas inspeccionadas | 30 |
| Tablas con RLS habilitada | 30 |
| Tablas con alguno de los privilegios SELECT/INSERT/UPDATE/DELETE para `anon` | 0 |
| Tablas con alguno de esos privilegios para `authenticated` | 0 |

**Interpretación:** no hay permisos de acceso directo a las 30 tablas privadas para los roles públicos de cliente. El aviso `rls_enabled_no_policy` no debe resolverse agregando políticas públicas sin justificación. Las funciones `SECURITY DEFINER` siguen requiriendo auditoría de autorización, ya que pueden acceder a tablas privadas bajo privilegios del definidor.

No se ejecutó ninguna sentencia de modificación de datos o esquema.
