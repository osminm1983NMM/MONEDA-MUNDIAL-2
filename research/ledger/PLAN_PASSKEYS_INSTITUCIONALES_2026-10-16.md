# Moneda Mundial 2.0 — preparación para Passkeys/WebAuthn
16 octubre 2026 — investigación, sin autenticación real habilitada.

## Entrega técnica
`src/server/passkey-research-policy.mjs` revisa, de forma estática y sin acceder a internet, ejemplos de configuración de relying party (RP ID), orígenes HTTPS exactos y subordinados al dominio, verificación de usuario obligatoria, vencimiento de desafío y sesión. Toda respuesta mantiene `actualPasskeyAssertionVerified=false`, `liveInstitutionalSessionEnabled=false`, pagos y operaciones financieras deshabilitados. `tests/passkey-research-policy.test.mjs` cubre orígenes falsos/HTTP, políticas débiles y acciones sensibles.

**No es una implementación WebAuthn.** El esquema NO analiza clientDataJSON, authenticatorData, rpIdHash, firma COSE ni contadores; no registra credenciales, ni obtiene certificado, ni genera llaves privadas, ni emite sesiones reales. La política de prueba falla cerrada. Una configuración aparentemente válida no acredita identidad ni es suficiente para producción.

## Arquitectura deseada
1. Proveedor de identidad empresarial y RP ID/HTTPS corporativos verificados. Biblioteca WebAuthn mantenida y auditada que verifique challenge único, origen exacto, RP ID, flags UP/UV, credencial ligada al empleado, firma, contadores y estado de respaldo.
2. Registro seguro de passkeys al alta presencial/institucional confirmada; recuperación de cuenta de alto riesgo con separación de funciones, revocación y notificaciones.
3. Sesiones rotadas, persistencia segura, expiración, replay protection y controles contra abuso; autorizaciones siempre desde servidor con vínculo activo a banco/agente y alcance mínimo de sucursal.
4. Segundo control independiente para desembolsos, devolución, retiro de efectivo y cambios de permisos; aprobación dual según riesgo y normativa. Nunca dar permiso desde `mfaVerified` pasado por teléfono.
5. Auditoría de acceso, protección de datos, evaluación de proveedores, continuidad de negocio y revisión técnica independiente.

## Bloqueos de negocio
La constitución y contratos financieros siguen pendientes, así como los controles KYC/KYB, AML, OFAC y las autorizaciones por corredor. La primera ruta candidata de remesas es US→HN; Nicaragua permanece en catálogo sin activación para dinero real. Moneda Mundial Digital y Moneda Mundial Coin continúan sin emisión real ni mercado.

## Fuentes técnicas
- W3C WebAuthn https://www.w3.org/TR/webauthn-3/
- NIST SP 800-63B https://pages.nist.gov/800-63-4/sp800-63b.html
