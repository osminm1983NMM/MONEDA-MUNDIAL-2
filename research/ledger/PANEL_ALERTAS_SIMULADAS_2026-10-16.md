# Panel de alertas — demostración administrativa
Fecha: 16 de octubre de 2026. Entorno estrictamente DEMO.

El propietario con rol verificado por el sistema de autenticación existente de la app puede acceder al componente `MockAlertsAdminScreen.js` dentro de Administración. Se muestran cuatro operaciones 100% inventadas en Honduras y Nicaragua, con señales calculadas localmente por `src/server/mock-risk-monitor.mjs`. El panel incluye vistas ilustrativas de propietario, banco y agente; una opción de vista es SÓLO UN FILTRO, no autentica bancos ni concede acceso al servidor. Las entidades son inventadas; los agentes no reciben importes ni etiquetas técnicas internas en su vista ilustrativa. No hay acciones de pago, reembolso, aprobación, desbloqueo ni escritura.

La política real de permisos para bancos y agentes NO existe aún. Antes de operar se necesita: autenticación individual verificable, autorizaciones en backend y RLS por entidad, vínculo institucional comprobado, aprobación regulatoria y acuerdos, registros auditables persistentes, gestión de incidentes, un proveedor contratado y revisión de privacidad.

Archivos: `src/admin/mock-financial-alert-dashboard.mjs`, `tests/mock-financial-alert-dashboard.test.mjs`, `MockAlertsAdminScreen.js` y `App.js`.

Esta implementación no habilita dinero, criptomonedas ni rutas financieras reales. El catálogo global se conserva; Honduras es primer corredor de estudio y Nicaragua sigue incluida.
