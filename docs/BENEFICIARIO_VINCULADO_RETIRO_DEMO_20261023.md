# Beneficiario vinculado al retiro — Moneda Mundial 2.0 (23 octubre 2026)

**Solo demostración.** Este trabajo protege una vulnerabilidad concreta de los ejemplos: anteriormente el alias del beneficiario podía introducirse al solicitar el código de retiro, sin compararlo con ningún destinatario registrado durante la creación de la remesa. Ahora la nueva ruta exige que el alias sintético quede unido a la transferencia al crearla y **rechaza cambiarlo después**, incluso por otro alias del mismo país.

## Composición del ejemplo (servidor Node)
- \`createMockProviderIntegrationPort\` crea la remesa ficticia. El proveedor no es banco, no realiza HTTP y su resultado de "completado" no confirma fondos.
- \`createMockCashPickupVerifier\` crea códigos \`SIMONLY-\` de muestra y comprueba alias, caducidad de 15 min, máximo de cinco intentos incorrectos y consumo una sola vez.
- \`createMockPickupBinding\` une remesa ficticia completada y caso de código SAMPLE.
- **Nuevo** \`createMockBeneficiaryBoundPickup\` es la entrada de laboratorio para registrar el alias \`SAMPLE-HN-...\` o \`SAMPLE-NI-...\` al enviar \`submitRecipientBoundMockTransfer\`. Emite con \`issueBoundSample\` sólo si alias y país coinciden con el registro original. \`inspectBoundSample\` nunca muestra el código.
- La misma \`requestId\` no puede cambiar beneficiario, país o importe. Tampoco puede adoptarse una remesa creada anteriormente por otro módulo sin registro de beneficiario. El código se muestra una sola vez al harness.
- Para verificar a un agente se utiliza por separado \`createMockAgentPickupSession\`, que exige sesión sintética de agente autorizado para el país. Ni esta sesión ni el alias demuestran identidad real.
- La ruta de emisión protegida sólo funciona si el entorno de laboratorio restringe el acceso directo al binding y al port. **No ofrece protección global contra otras rutas de código que puedan llamar directamente a las funciones subyacentes.**

## Pruebas
\`node --test tests/mock-beneficiary-bound-pickup.test.mjs\` o workflow \`test-mock-beneficiary-bound-pickup.yml\`. Cobertura: US→HN, US→NI, modificación de beneficiario en la misma remesa, reintentos, transferencia no vinculada, intento de reutilizar caso, agente de otro país, código de un solo uso y rechazo de datos personales.

## Limitaciones esenciales
Todo en memoria volátil; no hay autenticación de cliente ni proveedor financiero, identidad verificada, licencia, red de agentes real, fondos custodiados ni pago. No se conecta a Supabase/Android. La API sigue siendo **exclusivamente de prueba**; nunca enviar nombres verdaderos, documentos o códigos bancarios. Para producción son imprescindibles persistencia durable y transaccional, autorización de emisor y agente, vinculación cryptográfica y revisión de beneficiario KYC, separación de roles, límites anti abuso, auditoría externa, reconciliación bancaria e investigación de reclamos, revisiones de seguridad y acuerdos regulatorios.

\`REAL_PAYMENTS_ENABLED=false\`; **no habilitar pagos ni emitir códigos utilizables en el mundo real**.
