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
