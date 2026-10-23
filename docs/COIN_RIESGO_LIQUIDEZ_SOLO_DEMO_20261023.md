# Moneda Mundial Coin: liquidez y riesgo de mercado — SOLO DEMO (23 octubre 2026)

El nuevo módulo educativo `src/digital-money/coin-liquidity-risk-demo.mjs` estudia qué pasaría si una venta ficticia de Coin se cruzara con un mercado AMM de producto constante x*y=k con reservas inventadas. No consulta bolsas ni criptomonedas reales, no crea órdenes, no recibe fondos y no garantiza ningún precio ni redención.

En un ejemplo el pool contiene 100,000 Coin hipotéticas y USD 10,000 ficticios, dando un precio de referencia de 10 centavos por Coin. Una venta pequeña o grande altera el precio; el dinero total que aparentemente representa una oferta de 1,000 millones **no equivale** a dólares disponibles para vender todos los tokens.

El módulo analiza:
- Liquidez hipotética disponible y salida esperada bajo la fórmula.
- Diferencia entre valor teórico a precio spot y dinero que se recibiría bajo escenario.
- Impacto del precio después de una venta; **no** es predicción ni deslizamiento real.
- Límites ilustrativos del vendedor para mínimo neto y diferencia relativa.
- Señales de ventas que agotarían una fracción grande de las reservas ficticias.
- Choques independientes de venta del 1%, 5%, 10% y 25% de Coin circulantes sin sumarlos entre sí.

**El precio de Coin no debe prometerse como fijo, ni debe existir obligación de recompra o apoyo de cotización por la empresa sin estructura legal y reservas realmente verificables.** Moneda Mundial Digital es un producto distinto con requisitos de stablecoin. No mezclar fondos de clientes, liquidez de la tesorería, dinero recibido por ventas ni capitalización teórica. Los modelos AMM además tienen riesgos de manipulación y arbitraje.

Antes de lanzar: oferta máxima y circulación decididas formalmente, clasificación legal y de la oferta SEC/CFTC, FinCEN/MSB/licencias estatales según actividades, KYC/AML/sanciones, socio de custodia y mercados autorizados, vigilancia de manipulación y concentración, disclosures, auditorías, validación de precio por fuente confiable, prueba de liquidez y pruebas de ataques. No emitir tokens ni activar compra/venta; resultados son **estudios no ejecutables**.

Comprobar con `node --test tests/coin-liquidity-risk-demo.test.mjs`. No fusionar sin revisión.
