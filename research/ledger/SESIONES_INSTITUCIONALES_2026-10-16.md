# Sesiones y autenticación institucional — investigación Moneda Mundial 2.0
Fecha: 16 de octubre de 2026. **Sin empleados reales ni cuentas bancarias.**

## Avance
Se añadieron `src/server/mock-institutional-session-gateway.mjs` y `tests/mock-institutional-session-gateway.test.mjs` para simular inicio de sesión por desafío firmado con Ed25519, caducidad de desafíos (90 s), sesiones de prueba (15 min), tres intentos fallidos, cierre de sesión, invalidación al revocar membresía y límites por institución. Las claves de ensayo se generan dentro de la prueba: NO se entregan ni registran frases semilla ni llaves privadas en GitHub.

Las identidades son exclusivamente ficticias. El mecanismo NO implementa WebAuthn, MFA real, protección de hardware, identidad bancaria verificada, custodia ni un servidor HTTP. Una firma con clave de ensayo sólo verifica posesión de esa clave de prueba; no demuestra identidad legal ni permiso bancario. Los tokens viven en RAM y no se conectan a Supabase. No hay depósitos, pagos, cambios de saldo ni operaciones con Moneda Mundial Digital o Coin.

## Requisitos de producción antes de habilitar personal
- Instituciones legalmente verificadas y contrato, onboarding de empleados con control dual y permisos mínimos.
- Autenticación con soluciones consolidadas de MFA resistente a phishing (WebAuthn/passkeys), verificación de origen, attestation cuando corresponda y recuperación de cuenta segura.
- Backend HTTPS con sesiones almacenadas y rotadas de forma segura, cookies/CSRF o equivalentes, revocación compartida, anti-replay, límite de intentos por identidad y IP, telemetría y privacidad.
- RLS/capacidades vinculadas a identidad autenticada en servidor; no confiar en los selectores de rol de la app Android.
- Auditoría independiente, revisión KYC/KYB/AML/OFAC y bancos/regulación por corredor antes de dinero real.

Este progreso pertenece a la arquitectura de laboratorio en GitHub, NO cambia la autenticación real de Supabase.
