# Plan de integración PostgreSQL: alta de usuarios y apertura contable

**Estado:** pendiente de ejecutar. No utilizar base principal, ni cuentas reales, ni dinero real.

## Preparación
- Base PostgreSQL aislada, con esquema equivalente a `auth.users`, `public.mwd_profiles`, `public.mwd_wallets` y esquema privado de aperturas.
- Confirmar propietario, permisos y semántica de triggers de la versión Supabase usada.
- Aplicar primero `wallet-opening-schema-proposal.sql`, después `wallet-opening-trigger-integration-proposal.sql` (revisados para el entorno aislado).
- Crear identidades sintéticas; nunca copiar credenciales ni datos personales de producción.

## Casos obligatorios
1. Alta exitosa: una fila de perfil, billetera y asiento de apertura; importe coincide con `RETURNING balance_cents`.
2. Error al crear el asiento: alta de usuario, perfil y billetera se revierten completamente.
3. Error al crear billetera: tampoco persiste perfil ni usuario.
4. Doble alta del mismo identificador: falla o es idempotente de forma explícita; nunca duplica apertura.
5. Altas concurrentes: unicidad por usuario; no registros parciales.
6. `anon` y `authenticated` no pueden ejecutar directamente la función de trigger ni modificar asientos privados.
7. UPDATE/DELETE de apertura es rechazado incluso si un rol con DML intenta modificarla; documentar excepción de propietarios/superusuarios.
8. Alta con error deliberado: revisar registros de Auth para evitar que el cliente quede en un estado confuso y definir mensaje recuperable.
9. Reconciliación: apertura + movimientos = saldo, sin discrepancias.
10. Repetir pruebas con transacciones concurrentes y observar locks, errores SQLSTATE y tiempo de respuesta.

## Puerta de despliegue
No desplegar en base principal sin: pruebas PostgreSQL aprobadas, respaldo verificado, revisión de seguridad de `SECURITY DEFINER`/RLS/GRANT, estrategia de reversión, y aprobación explícita del propietario.

## Límite
Las 32 pruebas Node existentes son modelos aislados; este plan requiere un motor PostgreSQL real y no ha sido ejecutado.
