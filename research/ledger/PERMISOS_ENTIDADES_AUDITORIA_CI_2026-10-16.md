# Controles de acceso para futuros bancos y agentes — laboratorio
Fecha: 16 de octubre de 2026. Sin permisos reales ni datos financieros reales.

## Avance técnico
- `research/ledger/mock-partner-access-rls.sql`: ejemplo aislado de roles PostgreSQL para propietario, bancos HN/NI y agentes HN/NI, con políticas RLS por entidad, consultas de columnas restringidas y bitácora de solicitudes de revisión en modo append-only.
- `research/ledger/tests/mock-partner-access-rls-assertions.sql`: ensayos de que banco HN no puede ver NI, agente NI no puede leer importes, quien revisa no puede consultar auditoría ajena y no puede suplantar al propietario ni borrar historiales.
- Nueva etapa en GitHub Actions `verificar-ledger-investigacion.yml`; no hay despliegue en Supabase.

## Límites
Los roles SQL inventados NO son usuarios ni instituciones reales. Los permisos RLS de Postgres son sólo una **investigación técnica** y no se derivan de un JWT real ni ofrecen acceso a un banco. Los botones de «vista banco/agente» en la app continúan siendo filtros visuales de registros inventados, no una prueba de identidad.
La acción `request_manual_review_mock` NO permite pagar, liberar, reembolsar, identificar fraude ni consultar credenciales.
Se necesitan: autenticación de entidades verificada, contratos legales con los pagadores, autorización por persona y sucursal, backend autorizado, auditoría persistente con acceso limitado, revisiones independientes, cumplimiento KYC/AML/OFAC, políticas de privacidad y lanzamiento restringido por corredor.
Honduras sigue como primera ruta candidata real. Nicaragua y el catálogo global permanecen sin pagos habilitados.
