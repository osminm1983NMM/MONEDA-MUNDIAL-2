# Seguridad del backend para futuras API bancarias — 16 de octubre de 2026
**Estado: LABORATORIO SIN DINERO, SIN BANCO Y SIN CREDENCIALES REALES**

Se incorporó `src/server/mock-provider-security-gateway.mjs` junto a `tests/mock-provider-security-gateway.test.mjs`.

### Controles de investigación
- Validación HMAC SHA-256 de un sobre de eventos puramente ficticios, con mensaje ligado al proveedor y a una ventana temporal de 5 minutos.
- Credenciales ficticias separadas por proveedor y modelo de rotación con caducidad para clave anterior; claves sólo inyectadas al servidor. No se almacenan en el repositorio ni se devuelven a la app.
- Correlación de evento con proveedor, orden, importe, divisa y país. Rechazo de notificaciones manipuladas, antiguos mensajes repetidos, estados incompatibles y campos inesperados.
- Lista cerrada de proveedores abstractos alpha/beta, sin usar sus nombres como si fueran socios financieros reales.
- Honduras y Nicaragua figuran en ejemplos de laboratorio; otros países permanecen en catálogo de diseño.
- Respuesta siempre indica `realFundsEnabled=false`, `realBankAuthorized=false`, `canPostLedger=false`, `canPayout=false`. No existe llamada HTTP, token, emisión de monedas, orden verdadera ni liquidación.

### Riesgos y tareas pendientes para producción
1. Contrato legal/regulatorio y aprobación del corredor US→HN. No confundir constitución LLC con licencia.
2. Sandbox oficial de una entidad contratada, documentación real de mensajes y requisitos concretos de firma, mTLS, allowlists o OAuth. La autenticación HMAC de laboratorio no presupone que el proveedor use HMAC.
3. Gestor de secretos en servidor y rotación auditada, control de accesos, alertas y no exposición a React Native.
4. Persistencia duradera de deduplicación y correlación, transacciones ACID, ordenamiento de eventos, conciliación independiente, recuperación de caídas y límites antifraude.
5. KYC, AML, OFAC, protección al consumidor y reembolsos antes de lanzar dinero real.
6. Integración del ledger con eventos **de fondeo irrevocablemente liquidados**, no estados de transferencia procesada.
7. Mantener Coin variable y Moneda Mundial Digital estable aislados, sin emisión ni intercambios reales.

**Advertencia de seguridad:** el método `makeSyntheticSignedEvent` existe exclusivamente para tests; jamás publicar un firmador dentro del producto ni aceptar secretos de clientes como credenciales bancarias.
