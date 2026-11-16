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
