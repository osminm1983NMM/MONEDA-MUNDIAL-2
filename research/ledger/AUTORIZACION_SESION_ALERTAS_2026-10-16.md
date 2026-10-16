# Autorización integrada de sesiones y alertas institucionales
16 octubre 2026. Investigación estrictamente DEMO.

Se modificó `src/server/mock-institutional-session-gateway.mjs` para derivar el empleado, institución y país desde una sesión ficticia verificada en memoria, sin aceptar roles enviados por el cliente. Se añadió `src/server/mock-authorized-institution-alerts.mjs` para consultar registros inventados únicamente dentro del alcance derivado de esa sesión. Las vistas bancarias se limitan a su institución y las vistas de agentes omiten cantidades. Se prueban sesiones ausentes, expuestas a revocación y vencidas en `tests/mock-authorized-institution-alerts.test.mjs`.

**No existe un portal real para empleados.** Esto no es WebAuthn, MFA, JWT, persistencia de sesión o verificación jurídica de afiliación. El simulador sólo tiene identidades y casos inventados; no toca Supabase ni un proveedor real. No permite desembolsos ni transferencias, no emite Moneda Mundial Digital/Coin.

**Próximo trabajo:** estudiar servicio de identidad institucional gestionado, autenticación multifactor resistente a phishing y permisos persistentes vinculados a una institución legalmente incorporada y aprobada. Mantener cuatro frentes de lanzamiento de transferencias US→HN; Nicaragua y demás países en catálogo.
