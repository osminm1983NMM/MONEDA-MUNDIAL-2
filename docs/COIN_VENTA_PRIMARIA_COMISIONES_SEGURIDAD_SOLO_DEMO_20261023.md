# Moneda Mundial Coin: compra primaria y tesorería (SOLO DEMOSTRACIÓN)
Fecha: 2026-10-23. **Sin oferta pública, sin emisión de token, sin dólares ni Digital estable.**

## Decisión del fundador por estudiar, no aprobada
- Oferta máxima de **1,000 millones** sólo como supuesto matemático; **no** hay emisión, número aprobado o asignación legal.
- La empresa podría tener inicialmente inventario de Coin para distribuir mediante ventas autorizadas, plataformas y socios, sujeto a revisión legal y a contratos. **Controlar la tesorería propia no significa poder absoluto sobre monedas que se hayan transferido legítimamente a terceros.**
- La empresa no recibe una comisión automática por compras en exchanges independientes. La remuneración de cualquier plataforma o distribuidor requiere contrato o mecanismo verificable y autorizado.
- Moneda Mundial Coin y Moneda Mundial Digital son productos diferentes: la Digital requerirá emisor autorizado, reservas, redención y custodia apropiadas. No suponer precio fijo o conversión garantizada.

## Contrato del simulador
Archivo: \`src/digital-money/mock-coin-primary-sale.mjs\`.

\`createMockCoinPrimarySale\` calcula un precio inventado en **centavos enteros**, compra en centavos USD hipotéticos, unidades Coin enteras y tarifas en puntos básicos. Rechaza montos que no sean múltiplos exactos del precio para no ocultar centavos sin asignar. El precio se fija desde un fixture de configuración, **no desde el comprador**. No conecta a blockchain, banco, exchange, billetera, Supabase ni servidor de producción.

La misma \`requestId\` mantiene una sola cotización (120 segundos), un único recibo ficticio e idéntica comisión. Cantidad, comprador, o cotización diferentes con la misma referencia se rechazan. Dos cotizaciones pueden coexistir, pero la confirmación de laboratorio vuelve a comprobar el inventario y rechaza sobregiros. Las unidades simuladas pasan del inventario propio a la cuenta inventada del comprador; no hay ninguna función para quitarlas de ese comprador.

Los recibos separan:
- ingreso bruto **hipotético** por venta primaria (que **NO** equivale a beneficio neto);
- comisión de la plataforma (repartida con un socio **sólo como ejercicio**);
- saldo de Coin ficticio atribuible a compradores;
- inventario restante ficticio de la compañía.

### Ejemplo informativo (no tarifa publicada)
Empresa con inventario hipotético de 1,000,000,000 Coin y precio inventado de USD 0.10. Cliente compra USD 100 de Coin: 1,000 Coin. Comisión adicional de plataforma **1.50%** = USD 1.50. Si el **30% de esa comisión** correspondiera a un distribuidor por contrato: USD 0.45; la plataforma conservaría USD 1.05 **antes de costos e impuestos**. La compañía recibe también USD 100 de ingreso **bruto por venta de su propio inventario**, no ganancia neta. Total hipotético pagado por cliente: USD 101.50. Este reparto no aplica automáticamente a Coinbase, Binance ni otras plataformas.

Con USD 0.25 por Coin serían 400 Coin por USD 100 de principal (sin contar la comisión).

## Puertas de cumplimiento antes de cualquier operación auténtica
1. Revisar la estructura jurídica/propiedad del token, gobernanza, facultades administrativas, derechos del titular y riesgo de concentración. Una cláusula de control unilateral posterior a la venta puede crear riesgos de custodia, protección al consumidor y clasificación jurídica.
2. Analizar con abogados expertos la clasificación de la **oferta y venta de Coin**, conforme a la interpretación SEC del 17 de marzo de 2026, junto con la CFTC y cualquier norma estatal o federal aplicable. **La propuesta SEC Regulation Crypto Assets del 18 de agosto de 2026 sigue siendo propuesta**; no asumir exención vigente.
3. Revisar obligaciones FinCEN/MSB/BSA para administración, intercambio y transmisión de valor, licencias estatales y aplicación internacional por ruta.
4. Definir KYC, control de sanciones OFAC, antifraude, reclamaciones, custodia y seguridad de claves, impuestos, disclosures y un programa de protección al consumidor.
5. Auditoría independiente del contrato, gestión de llaves y despliegue, políticas de emisión/congelación según el diseño legal.
6. Para **Digital estable**, el GENIUS Act y la regulación OCC publicada el **21 de octubre de 2026**, con fecha de entrada en vigor **18 de enero de 2027**, definen requisitos significativos para emisores permitidos. No emitir Digital ni garantizar paridad USD sin socio/emisor autorizado, reserva y redención verificables.
7. La conexión Coin↔Digital no se activa con un documento auto-declarado: requiere proveedor y mercado autorizados, cotización validada, liquidez, prevención de dobles operaciones y conciliación externa.

### Fuentes oficiales de investigación (no asesoría jurídica)
- SEC interpretación efectiva 2026-03-23: https://www.sec.gov/rules-regulations/2026/03/s7-2026-09
- SEC propuesta Regulation Crypto Assets: https://www.sec.gov/rules-regulations/2026/08/s7-2026-27
- FinCEN FIN-2019-G001: https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models
- OFAC sanciones y monedas virtuales: https://ofac.treasury.gov/recent-actions/20211015
- OCC GENIUS Act regla final publicada 2026-10-21: https://occ.treas.gov/news-issuances/bulletins/2026/bulletin-2026-50.html

## Bloqueos actuales y prueba
- \`REAL_PAYMENTS_ENABLED=false\` y \`canTradeRealAssets=false\`; ninguna utilidad matemática habilita una emisión, venta ni conversión verdadera.
- Ya existen \`coin-market-demo.mjs\`, \`mock-coin-digital-settlement.mjs\` y \`crypto-release-gates.mjs\`; deben seguir separados de datos bancarios reales.
- Ejecutar \`node --test tests/mock-coin-primary-sale.test.mjs\` y el workflow \`test-mock-coin-primary-sale.yml\`.
- No fusionar antes de CI y revisión técnica. Se necesitan pruebas de dos cuentas verdaderas, auditoría independiente, validación legal y pruebas móviles antes de considerarlo producto real.
