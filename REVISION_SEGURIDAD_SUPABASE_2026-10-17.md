# Moneda Mundial 2.0 — revisión de seguridad de solo lectura
**Fecha:** 17 de octubre de 2026 · **Rama revisada:** `desarrollo-comercios-20261013`
**Supabase:** proyecto de demostración, sin autorización de dinero real.

## Trabajo realizado
Se ejecutó el diagnóstico `scripts/CONTROL_SEGURIDAD_PRELANZAMIENTO_20261017_READONLY.sql` contra la base de demostración activa, SIN modificar registros, políticas, saldos ni funciones.

| Comprobación observada | Resultado |
| --- | ---: |
| Funciones `public.mwd_%` encontradas | 53 |
| Funciones privilegiadas accesibles a usuario autenticado | 52 |
| Funciones `mwd_%` ejecutables como `anon` | 0 |
| Funciones privilegiadas sin `search_path` restringido según `proconfig` | 0 |
| Esquemas `mwd_*` privados con USAGE de `anon` o `authenticated` | 0 |
| Tablas públicas `mwd_%` sin RLS | 0 |
| Rutas de comisiones marcadas con pagos reales activados | 0 |
| Corredores centrales con estado diferente de `disabled` | 0 |
| Países en catálogo de diseño | 249 |
| Países HN y NI presentes | 2 |

**Importante:** Lo anterior verifica controles de configuración, NO que las 52 funciones privilegiadas estén correctamente autorizadas. La presencia de `auth.uid()` o de una función de propietario en el texto no demuestra seguridad; necesitan auditoría manual, pruebas con identidades reales de ensayo e intentos de acceso cruzado.

## Resultado de los asesores de seguridad de Supabase
- **52 advertencias `authenticated_security_definer_function_executable`.** Son funciones intencionalmente expuestas para operaciones DEMO con autenticación, pero deben revisarse individualmente. No revocar indiscriminadamente `EXECUTE`: rompería la app sin comprobar la alternativa segura.
- **1 advertencia de protección contra contraseñas filtradas desactivada.** No se cambió la configuración Auth desde esta revisión. Pendiente de habilitación y verificación en el panel Auth del proyecto, si está disponible.
- **30 avisos informativos `rls_enabled_no_policy`.** Varias tablas se mantienen aisladas en esquemas privados con RLS, sin `USAGE` concedido a clientes. Revisar los permisos de cada tabla y el uso de funciones privilegiadas antes de interpretarlos como problema o solución definitiva.

## Revisiones prioritarias pendientes
1. Revisar código de todas las RPC `SECURITY DEFINER` (validación de `auth.uid()`, rol owner fiable, propiedad por cuenta, bloqueo de doble operación, no IDOR). Ejecutar pruebas de rechazo como `anon` y con una segunda cuenta no propietaria.
2. Comprobar en Supabase Auth la protección contra contraseñas filtradas y la recuperación segura. No almacenar contraseñas ni códigos de acceso en GitHub.
3. Verificar manualmente en Android: dos sesiones, códigos de retiro vencidos/erróneos, concurrencia, pagos ficticios y recuperación de cuenta. CI verde no equivale a pruebas E2E en un equipo real.
4. Mantener todos los países en el catálogo; US→HN sólo es prioridad de evaluación. Ningún corredor debe activarse por código hasta contratos, licencias/alcance, pruebas de sandbox oficial y aprobaciones independientes.

## Límites del resultado
- Supabase mantiene todos los mecanismos de dinero real **deshabilitados** según las comprobaciones consultadas.
- No existe vínculo confirmado con proveedor financiero de producción ni transferencias bancarias reales.
- No se ejecutaron pruebas con cuentas ajenas, mutaciones de base ni simulaciones de pago en esta auditoría.
- Si cambian funciones, privilegios o migraciones, ejecutar de nuevo este diagnóstico y consultar los asesores de Supabase.

Referencias: [Linter: funciones privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [Protección contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
