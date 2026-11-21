# Revisión de seguridad Supabase — 2026-11-21

## Alcance

Lectura de los asesores de seguridad, rendimiento y salud; catálogos PostgreSQL de permisos y definiciones de RPC. No se aplicaron migraciones ni se modificaron ajustes o datos.

## Hallazgos

- **Salud:** el asesor de Supabase no devolvió alertas de salud.
- **Esquemas privados:** el rol `authenticated` no tiene privilegio `USAGE` en `mwd_finance_private`, `mwd_pickup_private` ni `mwd_partners_private`. El asesor cuenta 30 tablas con RLS activado y sin políticas en esquemas privados; sin privilegio de esquema, esas tablas no quedan accesibles directamente por ese rol. Mantener el comportamiento de denegación y revisar la lista de esquemas expuestos antes de producción.
- **Funciones SECURITY DEFINER:** el asesor advierte que 56 funciones son ejecutables por `authenticated`. Esto incluye RPC intencionales. La consulta del catálogo no encontró funciones `SECURITY DEFINER` ejecutables por ese rol sin `search_path` vacío. Las RPC de transferencia, estado idempotente y retiro revisadas derivan el actor de `auth.uid()`; los procedimientos `mwd_owner_*` revisados usan `assert_owner()` o verifican el rol del propietario.
- **Protección de credenciales:** Supabase informa que la protección contra contraseñas filtradas está desactivada. Habilitarla y documentar los parámetros de autenticación antes de invitar usuarios externos.
- **Rendimiento:** el asesor reporta claves foráneas sin índice y varios índices no usados. Son avisos informativos en una base de demostración; no se añadieron ni quitaron índices sin mediciones de carga.

## Almacenamiento local de sesión

- **Estado actual:** Supabase Auth persiste la sesión en `AsyncStorage`; las referencias de reintento de operaciones también usan almacenamiento local, separadas de la sesión.
- **Evaluación:** no conviene guardar la sesión completa directamente en `SecureStore` sin medir y manejar errores por tamaño. La guía de Expo advierte que algunas cargas grandes pueden ser rechazadas; la guía oficial de Supabase para Expo plantea cifrar la sesión en `AsyncStorage` y guardar la clave de cifrado en `SecureStore`.
- **Decisión para esta rama:** mantener el almacenamiento actual hasta implementar y validar una capa cifrada compatible con Android y web. La migración debe leer sesiones anteriores, escribir y verificar la sesión cifrada antes de borrar el valor anterior, y conservar el inicio de sesión si la migración falla. No guardar datos pendientes de operación como credenciales.
- **Validación requerida antes de adoptarlo:** probar inicio y cierre de sesión, renovación de token, recuperación PKCE, actualización de sesión grande, migración de instalación existente y recuperación tras fallo de lectura/escritura en un Android instalado. La exportación JavaScript por sí sola no valida el almacén nativo.

## Revalidación de asesores

Lectura de solo consulta el 2026-11-21: salud sin avisos; seguridad mantiene 30 tablas con RLS sin políticas en esquemas privados, 56 funciones `SECURITY DEFINER` ejecutables por `authenticated` y la protección contra contraseñas filtradas desactivada; rendimiento mantiene 24 claves foráneas sin índice y 17 índices no usados. Los avisos de funciones se contrastaron con controles de propietario/actor y `search_path` vacío en la revisión de catálogo; los permisos no se modificaron. Los avisos de rendimiento son informativos y requieren mediciones antes de tocar índices.

## Pendiente antes de cualquier uso real

- [ ] Habilitar protección contra contraseñas filtradas en Supabase Auth.
- [ ] Revisar cada RPC expuesta con pruebas negativas de permisos y llamadas entre cuentas.
- [ ] Confirmar dominios/esquemas expuestos y grants después de cualquier cambio de backend.
- [ ] Repetir la revisión de asesores después de migraciones y antes del lanzamiento.

Esta revisión no es una prueba de penetración, certificación ni aprobación para procesar dinero real.
