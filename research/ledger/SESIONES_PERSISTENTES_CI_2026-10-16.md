# Sesiones institucionales persistentes — estudio de seguridad
Fecha: 16 octubre 2026. Exclusivamente laboratorio PostgreSQL efímero CI.

Se creó `research/ledger/mock-persistent-institution-sessions.sql` y sus pruebas. El modelo almacena sólo el resumen SHA-256 de identificadores de sesión ficticios, empleado/entidad de ejemplo, emisión, vencimiento y revocación. La función de evaluación comprueba en cada solicitud: sesión existente, no vencida, no revocada, miembro actualmente activo y correspondencia de entidad con el caso asignado. Responde siempre con fondos reales y MFA reales deshabilitados.

La rutina no está autorizada a roles de empleados ni usuarios móviles; únicamente es un modelo de datos evaluado por el dueño de la BD temporal, **no es una API bancaria ni un sistema de login**. No almacena credenciales, cookies, secretos de proveedor o identidad de clientes. No se modificó Supabase.

### Antes de producción
Un proveedor de identidad autorizado, WebAuthn/passkeys con origen verificado y MFA resistente al phishing, sesiones verdaderas con caducidad y rotación, controles antifuerza bruta, servidor/API con autorización por recurso, auditoría independiente, revocación distribuida, privacidad, contratos y verificación KYB de instituciones. Ninguna consulta SQL de laboratorio autoriza bancos ni pagos.

Moneda Mundial sigue trabajando primero en US→HN, mientras NI y catálogo internacional se mantienen en planificación. Coin y Digital siguen sin emisión.
