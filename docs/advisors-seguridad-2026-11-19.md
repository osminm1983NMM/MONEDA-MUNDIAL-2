# Diagnóstico de asesores Supabase — 2026-11-19

Inspección de solo lectura del proyecto `egrsdrlpavrtbgxoyxvg`, sin ejecutar SQL de escritura ni activar servicios de pago.

## Avisos de seguridad

- **WARN, 56** funciones `SECURITY DEFINER` ejecutables por `authenticated`: revisar cada función, empezando por las que modifican dinero ficticio, privilegios y órdenes. No revocar indiscriminadamente: varias son parte del flujo previsto y requieren autorización interna. https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- **WARN, 1**: protección de contraseñas filtradas (Leaked Password Protection) requiere revisión de configuración de Auth. https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- **INFO, 30** tablas en esquemas privados con RLS habilitado sin políticas: puede ser intencional si se accede solo mediante funciones controladas; confirmar privilegios y exposición antes de cambiar políticas. https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Prioridad

1. Auditar autorización interna de las RPC privilegiadas de pagos, roles, transferencias y remesas.
2. Revisar y, si corresponde, activar protección contra contraseñas comprometidas en Auth.
3. Confirmar que los esquemas privados no están expuestos y sus tablas no tienen permisos directos inesperados.
4. Ejecutar pruebas de autenticación A/B y concurrencia antes de certificar la app.

No se consideran vulnerabilidades explotadas; son avisos de configuración y superficie de ataque que requieren análisis. No se modificó `main`.
