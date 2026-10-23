# Protección de intención en remesas internacionales — SOLO DEMO (23 oct 2026)

**Propósito:** impedir que dos pulsaciones o intentos similares se conviertan silenciosamente en dos órdenes ficticias nuevas. No confundir esta barrera de laboratorio con antifraude bancario ni garantía sobre dinero real.

## Alcance
- Motor: \`createMockInternationalTransferGuard\` en \`src/server/mock-international-transfer-guard.mjs\`, conectado **únicamente** a \`createMockPaymentLifecycle\` (órdenes volátiles, importes USD ficticios).
- Identificadores sintéticos obligatorios: \`SIM-US-SEND001\`, \`SIM-HN-RECIP01\`, \`SIM-NI-RECIP02\` (no nombres, correos, documentos ni números de cuenta).
- Acepta cualquier código de país ISO de dos letras a nivel de validación de entrada. **Sólo se podrá crear una orden de prueba** si el motor de laboratorio tiene activado ese país; por defecto están HN/NI. Esto **no elimina otros países del proyecto**.
- \`previewMockTransfer\`: sólo lectura; presenta monto, destino, alias del beneficiario y aviso de posible duplicado si el mismo remitente, beneficiario, destino e importe se usaron en una orden ficticia de los últimos 10 minutos.
- \`submitMockTransfer\`: requiere la referencia exacta de la previsualización (expira en 120 segundos). Si hay coincidencia, exige \`acknowledgeDistinctDuplicate:true\` para crear **otra** operación deliberada. La misma \`requestId\` es idempotente.
- Si se crea otra orden entre la vista previa y la confirmación, la confirmación caduca lógicamente y exige volver a revisar, aun cuando el usuario marcó aceptación de duplicación. Cambiar el importe/beneficiario con la misma clave se rechaza.
- No implementa interfaz Android todavía: es un **control de dominio de servidor simulado** para integrar y revisar posteriormente.

## Pruebas y advertencias
Ejecutar \`node --test tests/mock-international-transfer-guard.test.mjs\`, y verificar el workflow \`mock-international-transfer-guard.yml\` en GitHub Actions. Requiere revisión y pruebas Samsung antes de integrar cualquier pantalla de confirmación.

**Bloqueos obligatorios antes de producción:** persistencia y transacciones atómicas de idempotencia en base de datos, aislamiento autenticado del remitente, verificación real de beneficiario, políticas antifraude, tratamiento de ventanas de reintento entre servidores, auditoría inmutable externa, conciliación de proveedor/banco regulado, KYC/AML, contratos/licencias, error recovery y pruebas de concurrencia. Reiniciar este proceso borra la memoria de órdenes y bloqueos. Los alias no son identidades verificadas.

**Estado:** sin conexión a banco, Supabase ni fondos; no transfiere ni devuelve dinero real, no emite monedas. \`REAL_PAYMENTS_ENABLED=false\` sigue obligatorio. PR en borrador hasta revisión.
