# Personal institucional y revocación — Moneda Mundial 2.0
16 de octubre de 2026. **Arquitectura de laboratorio: NO habilitada para personal real, bancos ni agentes.**

Se creó el archivo `research/ledger/mock-institution-staff.sql` para estudiar cuentas de empleados de instituciones ficticias HN y NI, estados `pending_mock / active_mock / revoked_mock`, aislamiento de consultas por rol institucional, permisos mínimos para empleados y trazabilidad de cambios. Un trabajador de prueba no puede modificar sus propios permisos ni ver órdenes de otra institución; la revocación retira acceso al instante en la siguiente consulta SQL. Todos los estados se definen en PostgreSQL efímero, sin identificación, correo, claves ni acceso real.

Las comprobaciones se guardan en `research/ledger/tests/mock-institution-staff-assertions.sql` y se ejecutan en el workflow de contabilidad aislada.

**Limitaciones y condiciones de lanzamiento:** el sistema no autentica usuarios reales ni procesa invitaciones; `SET ROLE` en CI no equivale a login, MFA, certificado institucional o JWT válido. En producción debemos validar contratos con bancos y agentes, implementar identidad de empleados, asociación verificada con entidad legal, alta con doble control, MFA contra phishing, tokens de corta duración, auditoría inmutable en servidor, límites por sucursal, revocación de sesiones y RLS sin escalación. Ningún permiso de laboratorio autoriza fondos, efectivo, reembolsos o criptoactivos. Honduras primer piloto propuesto; Nicaragua y catálogo mundial en diseño.
