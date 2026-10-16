# Integración de confirmaciones bancarias con el libro mayor (diseño)
Fecha: 16 octubre 2026. Sin contrato, API bancaria, webhook externo, fondos reales ni despliegue de contabilidad en Supabase.

## Avance
- El workflow de contabilidad aislada para el commit `45b7d82c` terminó **success**. Sólo es una prueba CI de PostgreSQL desechable.
- Se añadió restricción única sobre `(event_type, external_reference)` en la tabla de diarios de investigación para rechazar una segunda acreditación de la misma referencia incluso con un request ID distinto.
- `src/server/mock-bank-ledger-coordinator.mjs` acopla el verificador simulado de firma HMAC y estado del proveedor con una **propuesta** de asiento contable, pero nunca escribe el diario ni reclama recepción de fondos reales.
- `tests/mock-bank-ledger-coordinator.test.mjs` ensaya firma alterada, rechazo antes de confirmación, duplicación y los ejemplos US→HN y US→NI.

## Advertencia fundamental
Una notificación `sandbox_completed` **no es constancia de fondeo**, ni se debe confundir `transfer completed` con `funding settled`. Antes de conectar bancos reales será necesario separar eventos de financiamiento, aceptación, liquidación y desembolso según los contratos del proveedor, y correlacionarlos con identificadores autenticados del proveedor. El adaptador actual deliberadamente NO crea asientos.

## Etapa siguiente
Cuando un proveedor regulado haya concedido sandbox oficial: mapear estados documentados, autenticar firmas reales, persistir idempotencia y asociación al emisor de eventos, manejar conciliación de extractos auténticos, aplicar controles de KYC/AML y prueba de dobles abonos concurrentes. Asegurar pruebas aisladas y revisión independiente antes de cualquier operación real.

## Objetivos paralelos
Entidad jurídica y cuenta de empresa, proveedor autorizado para primera ruta US→Honduras, obligaciones legales US/HN y países de expansión, infraestructura de pagos y separación de Moneda Mundial Coin vs Digital. Nicaragua y demás países permanecen en catálogo como destinos de diseño.
