# Moneda Mundial 2.0 — ruta paralela para criptomonedas

Fecha: 17 de octubre de 2026. **DISEÑO Y PRUEBAS. NO HAY TOKEN EMITIDO NI PAGO CRIPTO ACTIVO.**

## Tres saldos sin confusión

- **Créditos MWD (DEMO):** son números ficticios del laboratorio, sin valor económico, no canjeables por efectivo, Coin ni Digital.
- **Moneda Mundial Coin:** criptomoneda **de precio variable**, con oferta/emisión por determinar yjeta a análisis económico y legal. Se estudia un contrato ERC-20; la investigación actual es abstracta y no desplegable. No fijamos un precio inicial, no prometemos rentabilidad.
- **Moneda Mundial Digital:** activo de pago de **valor estable deseado**, potencialmente una stablecoin **separada**. La aspiración comercial de referencia 1 unidad ≈ 1 USD **no crea** respaldo, garantía, redención ni estabilidad. Se debe definir emisor habilitado, reserva, informes y derecho a redimir, o evaluar una stablecoin de tercero autorizado. No se emite aquí.

## Flujo que se quiere construir, todavía inhabilitado

1. Un cliente obtiene Coin **solo en mercado regulado y autorizado**, una vez que el token exista, esté legalmente ofrecido y tenga liquidez verificable.
2. La app muestra precio, riesgo, comisiones, red, cotización temporal, vencimiento, impuestos aplicables y consentimiento; jamás inventa cotizaciones.
3. Si un socio autorizado permite el intercambio, se podría cambiar Coin → Digital, con controles AML, custodia y liquidación verificada.
4. Digital se podría usar para pagos a comercios y envíos internacionales donde haya contrato, permisos de origen/destino, socio pagador y fondos efectivamente confirmados.
5. El usuario puede retirar por cuenta o por agente autorizado cuando los requisitos reales estén satisfechos; el código DEMO jamás habilita pago.

## Cinco decisiones independientes antes de poder operar

- **Coin:** oferta y distribución, modelo de utilidad, clasificación regulatoria, gobernanza, auditoría del contrato, red y custodia de claves.
- **Digital:** emisor legal y regulado o tercero autorizado, reservas y mecanismos de redención, protección al usuario, prueba de reservas y controles de emisión.
- **Billeteras:** custodia propia vs proveedor, recuperación, respaldo seguro, prohibición de guardar llaves privadas/semillas en servidor, app, chats o GitHub.
- **Conversión Coin ⇄ Digital:** exchange/market maker autorizado, liquidez, tipos de cambio demostrables, slippage, transacciones atómicas, conciliación, reembolsos y disputas.
- **Pagos y remesas:** análisis de licencias por país, responsabilidad KYC/AML/OFAC y protección al consumidor en cada ruta. Mantener todos los países en el catálogo; ninguno queda habilitado automáticamente.

## Trabajo verificable preparado

- `src/digital-money/crypto-release-gates.mjs`: matriz explícita de requisitos por fase. Aunque alguien afirme tener toda la documentación, no activa tokens ni transacciones.
- `tests/crypto-release-gates.test.mjs`: prueba separación entre DEMO, Coin y Digital; caducidad/alcance; rechazo de documentos inseguros; siempre bloquear mercado, emisión y retiros.
- `research/coin-contract/`: prototipo anterior ERC-20 **abstracto**; contrato real, claves y despliegue siguen pendientes.

**Ruta de experimentación:** auditar economía y régimen legal → contrato de prueba concreto en repositorio aislado / testnet sin fondos reales y con permisos → pruebas reproducibles y auditoría → socios autorizados/licencias → decisión de lanzamiento. La investigación EVM/Base Sepolia no confirma que esa sea la red final.

Ningún parámetro `verified` del cliente puede dar autorización de producción. La aprobación la debe otorgar un proceso institucional independiente.

Referencias técnicas y regulatorias de consulta, no dictamen jurídico:
- OpenZeppelin ERC20 https://docs.openzeppelin.com/contracts/5.x/api/token/erc20
- FinCEN virtual currencies https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-persons-administering
- GENIUS Act y supervisión de emisores de stablecoins, reglas vigentes aplicables https://www.govinfo.gov/content/pkg/FR-2026-09-30/html/2026-19966.htm
