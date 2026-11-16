# Auditoría de aislamiento de tablas privadas de remesas DEMO

Fecha: 2026-11-16. Consultas de solo lectura a catálogos PostgreSQL en Supabase.

## Resultado

Las siete tablas del esquema mwd_remittance_demo_private tienen RLS habilitada:
- orders
- events
- payout_assignments
- payout_events
- pickup_code_attempts
- pickup_code_events
- pickup_code_samples

Para las siete tablas, el rol anon carece de SELECT y el rol authenticated carece de SELECT, INSERT y UPDATE. El rol authenticated tampoco tiene USAGE sobre el esquema privado.

## Alcance y límites

Estos resultados muestran privilegios SQL declarados y configuración RLS, no prueban el comportamiento de todas las funciones SECURITY DEFINER. RLS no está forzada (FORCE ROW LEVEL SECURITY=false); funciones privilegiadas pueden eludirla y deben verificar autorización internamente.

Pendiente: probar con sesiones anónimas, autenticadas sin rol y propietario en un laboratorio aislado; revisar por separado DELETE, otros grants y las funciones públicas expuestas antes de una certificación integral.

No se alteraron datos, tablas, permisos, saldos ni políticas.