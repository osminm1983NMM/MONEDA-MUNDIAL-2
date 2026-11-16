# Cobertura confirmada de pruebas PostgreSQL — 2026-11-16

## Resultado confirmado
- GitHub Actions https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/43886600113 — **success**.
- Registro de ejecución contiene `POSTGRES_SIGNUP_INTEGRATION_PASS`, `POSTGRES_CONCURRENT_SIGNUP_PASS` y `POSTGRES_SIGNUP_FAILURE_MATRIX_PASS`.
- PostgreSQL 16 efímero, sin conexión a Supabase principal.
- Suite Node de 32 pruebas también aprobada en https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/43886600016.

## Alcance verificado
- Registro normal crea perfil, billetera y apertura.
- Error inyectado en apertura, perfil o billetera revierte el alta.
- Dos conexiones compitiendo por un mismo UUID dejan exactamente una cuenta completa.
- Duplicado de usuario rechazado.
- UPDATE y DELETE de apertura rechazados.
- Privilegio EXECUTE sobre función de alta no concedido a `anon` ni `authenticated` en el entorno de pruebas.

## Riesgos pendientes
- Este contenedor no reproduce todas las políticas ni roles reales de Supabase Auth.
- Falta probar transferencia monetaria concurrente con funciones PostgreSQL reales y saldos de ambos usuarios.
- Falta reconciliación integral con emisión y contrapartida de saldos iniciales, y reconstrucción histórica auditada.
- Falta revisión de migración, RLS/GRANT, respaldo/restauración, reversión, observabilidad y aprobación explícita antes de desplegar.
- Las pruebas verifican escenarios definidos, no demuestran seguridad completa ni aptitud para dinero real.
