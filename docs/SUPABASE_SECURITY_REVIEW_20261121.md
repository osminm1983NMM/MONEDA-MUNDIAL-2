# Revisión de seguridad Supabase — 2026-11-21

## Alcance

Lectura de los asesores de seguridad, rendimiento y salud; catálogos PostgreSQL de permisos y definiciones de RPC. No se aplicaron migraciones ni se modificaron ajustes o datos.

## Hallazgos

- **Salud:** el asesor de Supabase no devolvió alertas de salud.
- **Esquemas privados:** el rol `authenticated` no tiene privilegio `USAGE` en `mwd_finance_private`, `mwd_pickup_private` ni `mwd_partners_private`. El asesor cuenta 30 tablas con RLS activado y sin políticas en esquemas privados; sin privilegio de esquema, esas tablas no quedan accesibles directamente por ese rol. Mantener el comportamiento de denegación y revisar la lista de esquemas expuestos antes de producción.
- **Funciones SECURITY DEFINER:** el asesor advierte que 56 funciones son ejecutables por `authenticated`. Esto incluye RPC intencionales. La consulta del catálogo no encontró funciones `SECURITY DEFINER` ejecutables por ese rol sin `search_path` vacío. Las RPC de transferencia, estado idempotente y retiro revisadas derivan el actor de `auth.uid()`; los procedimientos `mwd_owner_*` revisados usan `assert_owner()` o verifican el rol del propietario.
- **Protección de credenciales:** Supabase informa que la protección contra contraseñas filtradas está desactivada. Habilitarla y documentar los parámetros de autenticación antes de invitar usuarios externos.
- **Rendimiento:** el asesor reporta claves foráneas sin índice y varios índices no usados. Son avisos informativos en una base de demostración; no se añadieron ni quitaron índices sin mediciones de carga.

## Pendiente antes de cualquier uso real

- [ ] Habilitar protección contra contraseñas filtradas en Supabase Auth.
- [ ] Revisar cada RPC expuesta con pruebas negativas de permisos y llamadas entre cuentas.
- [ ] Confirmar dominios/esquemas expuestos y grants después de cualquier cambio de backend.
- [ ] Repetir la revisión de asesores después de migraciones y antes del lanzamiento.

Esta revisión no es una prueba de penetración, certificación ni aprobación para procesar dinero real.
