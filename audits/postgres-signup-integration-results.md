# Resultado de integración PostgreSQL aislada — 2026-11-16

## Ejecución confirmada
- GitHub Actions: https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/43884468553
- Resultado: `success`; salida SQL `POSTGRES_SIGNUP_INTEGRATION_PASS`.
- Motor: PostgreSQL 16 en contenedor efímero de GitHub Actions.
- Código bajo prueba: `tests/postgres-signup-integration.sql`, `audits/wallet-opening-schema-proposal.sql`, `audits/wallet-opening-trigger-integration-proposal.sql`.
- Sin conexión a la base Supabase principal, sin cambios de saldos ni datos reales.

## Verificaciones ejecutadas
1. Alta sintética genera perfil, billetera y apertura con 1,000,000 centavos MWD ficticios.
2. Fallo inyectado al insertar apertura revierte `auth.users`, perfil y billetera.
3. Restricción de privilegio EXECUTE para `anon` y `authenticated` sobre función trigger.
4. UPDATE de apertura bloqueado por trigger.
5. Alta duplicada rechazada por clave única y no duplica apertura.

## Pendientes antes de despliegue
- Simular permisos reales de Supabase Auth y propiedad de funciones/roles (el contenedor no replica todo Supabase).
- Pruebas de altas concurrentes en conexiones independientes.
- Prueba de fallo al insertar perfil y billetera; DELETE de asientos.
- Comprobar provisión, emisión/contrapartida y reconstrucción de aperturas antiguas.
- Revisar RLS, GRANT, SECURITY DEFINER y asesorías de seguridad.
- Respaldo, rollback, plan de despliegue y aprobación explícita.

No se afirma preparación para operaciones con dinero real.
