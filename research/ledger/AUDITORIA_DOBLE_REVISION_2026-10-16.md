# Bitácora de doble revisión — laboratorio de Moneda Mundial
16 de octubre de 2026. Todas las revisiones, identidades y operaciones son INVENTADAS.

Se integró `src/server/mock-dual-review-audit.mjs` al controlador `src/server/mock-dual-review.mjs`. Ahora se registra en memoria la creación de revisión, los rechazos por autoaprobación, intentos de otra institución, segunda revisión, expiración y revocación de iniciador. Las anotaciones contienen sólo ID sintético de caso/revisión/institución/empleado, categoría, estado y momento. Cada anotación enlaza un resumen SHA-256 de la anterior, con comprobación de integridad destinada a pruebas.

Pruebas en `tests/mock-dual-review-audit.test.mjs` comprueban la secuencia, detección de alteración, detección de registros faltantes y transición caducada o revocada sin repetir evidencias.

**Alcance limitado:** hash en RAM no es auditoría legal inmutable; alguien con control del proceso podría alterar todos los eventos y recalcular hashes. No hay logs externos, firmas/atestaciones, autenticación WebAuthn real, datos bancarios o fondos. Ninguna revisión libera dinero, realiza reembolsos o cambia permisos. Para producción exigir almacenamiento de sólo anexado con retención y sellado externo, RLS por organización, supervisión antifraude, trazabilidad de decisiones, autorización dual verificable y servicio regulado contratado.

Honduras sigue como primera ruta candidata US→HN. Nicaragua y resto del catálogo global continúan planeados.
