# Moneda Mundial Coin — control de tesorería y revisión legal (23 de octubre de 2026)

## Estado: PLANEACIÓN, SIN OFERTA NI EMISIÓN
La compañía quiere estudiar una posible oferta máxima de **1,000,000,000 Coin** y, como modelo de negocio, gestionar inicialmente el inventario *que legítimamente pertenezca a la tesorería*, incluso el 100% antes de ventas. **NO hay decisión final sobre emisión, cantidad, blockchain, reparto ni precio.** Las Coin no existen todavía.

**Distinción fundamental:** administrar monedas propias no da propiedad sobre las monedas que compró otra persona ni licencia para retirar/confiscar activos de compradores. El control administrativo de un contrato (si existiera), la titularidad legal de tokens, los saldos bajo custodia y los poderes de gobernanza son cosas separadas que deben declararse con transparencia.

En este diseño no ejecutable se evalúan propuestas de distribución sin alterar activos: inventario de compañía, monedas previstas para público, programa de socios/distribuidores, liquidez y comunidad. Un ejemplo con 1,000 millones parte de tesorería hipotética de 1,000 millones y **planea** transferir 150 millones a distribución pública, 50 millones a programa de socios y 100 millones a provisión de liquidez, quedando 700 millones en tesorería. Son **ejemplos, no porcentajes aprobados**. Ninguna plataforma internacional está obligada a listar Coin ni a compartir comisiones; deben existir contratos y/o reglas de mercados aplicables.

Si la dirección considera facultades como emisión sin tope, confiscación unilateral posterior a la compra, restricciones de transferencias ocultas o promesas de rentabilidad, el instrumento señala esos riesgos para revisión. No diseñar garantías de beneficio, retorno o estabilidad de precio de Coin.

## Matriz legal previa a la oferta (revisión externa indispensable)
- **SEC / CFTC — calificación de Coin y de la *oferta***. La interpretación de la SEC emitida 17 marzo de 2026 (efectiva 23 marzo) distingue el activo de las circunstancias de cada venta. La calificación depende de derechos, publicidad, promesas y expectativas de beneficios por gestiones de terceros. Los **FAQ del personal de la SEC de 25 septiembre 2026 no son una regla ni tienen fuerza de ley**. Solicitar dictamen legal por producto y ruta de distribución.
- **FinCEN / BSA**: analizar las funciones reales de emisor, distribuidor, intercambiador, procesador, transmisor y custodio; determinar obligaciones como MSB, registro, programa AML, KYC y reportes, si aplican. El nombre "criptomoneda" por sí solo no exime.
- **Estados de EE. UU.**: evaluar licencias de transmisión del valor/moneda virtual donde corresponda y el papel de distribuidores autorizados. **Maryland** indica expresamente que su ámbito de transmisores incluye transmisión de moneda virtual. La constitución de una LLC no reemplaza licencias financieras.
- **OFAC**: desarrollar revisión de sanciones aplicables, monitoreo, georrestricciones según asesoría, trazabilidad y proceso de alertas.
- **Propiedad y consumidores**: definir whitepaper con derechos del comprador, riesgos, bloqueos administrativos, controles de mint/burn/freeze, comisiones, liquidez, custodia, reclamos, impuestos, publicidad sin promesas de ganancias y divulgaciones a socios.
- **Contrato/token**: auditoría de smart contracts, llaves en custodia segura, segregación de funciones, límites de emisión, plan de incidentes, contrato publicado sólo tras evaluación legal. No solicitar claves ni semilla a clientes para ensayos.
- **Moneda Mundial Digital**: está separada de Coin. Según el **OCC 21 oct 2026**, la regla final de GENIUS Act entra en vigor el **18 ene 2027** y cubre emisores de stablecoins de pago dentro de su jurisdicción, incluyendo reservas, redención, custodia, auditorías y autorizaciones. **No emitir Digital ni garantizar 1:1 con USD sin contar con emisor autorizado y salvaguardas verificables.**

## Nuevo módulo de planeación, jamás de producción
`src/digital-money/coin-governance-prelaunch.mjs`
- `previewCoinTreasuryGovernance`: acepta *cantidades enteras ficticias*, verifica inventario y propuestas sin sobreasignar, calcula porcentajes en puntos básicos y expone riesgos de poderes administrativos.
- `assessCoinPrelaunchEvidence`: lista 10 frentes que requieren documentos de asesores externos. **No verifica autenticidad, vigencia real ni aprobación legal**; aun con todos los campos presentes, ninguna venta se habilita.
- Todas las señales operativas siguen `false`: `tokenIssued`, `publicSaleAuthorized`, `realFundsEnabled`, `stablecoinCanBeIssued`, etc.
- El modelo NO se conecta a blockchain, banco, proveedores, Supabase, Android ni billeteras; no emite ni asigna monedas reales.

## Preguntas que el abogado y los asesores técnicos deben resolver
1. ¿Coin tendrá una utilidad verificable independiente de la expectativa de apreciación? ¿Qué promesas se mostrarían en marketing?
2. ¿Quién sería el emisor y qué derechos exigibles tendría cada tenedor? ¿Qué potestades de congelación o recuperación son justificables y transparentes?
3. ¿Es legal el ofrecimiento inicial directo por la empresa, y bajo qué régimen? ¿Qué vende exactamente el proveedor asociado y quién retiene custodia de los fondos?
4. ¿Quién controla llaves, contratos, tesorería y cambios de parámetros? ¿Qué aprobación conjunta requiere cualquier decisión?
5. ¿Qué obligaciones federales/estatales, de otros países, AML/sanciones, fiscales y de atención a consumidores son aplicables antes del primer dólar?
6. ¿Coin y Digital tendrán emisor(es) y servicios separados? ¿Existirá una entidad autorizada para emitir Digital bajo GENIUS Act?

**No aprobar precio, distribución, porcentaje de socios o calendario de venta hasta tener evaluación profesional, recursos y capacidades.**

## Referencias oficiales consultadas 2026-10-23
- SEC interpretación vigente: https://www.sec.gov/rules-regulations/2026/03/s7-2026-09
- SEC explicación Howey: https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/transactions-involving-crypto-assets
- SEC FAQ personal (no vinculante), 2026-09-25: https://www.sec.gov/about/divisions-offices/division-corporation-finance/faqs-crypto-assets
- FinCEN FIN-2019-G001: https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models
- OFAC compliance virtual currency: https://ofac.treasury.gov/recent-actions/20211015
- Maryland money transmitters: https://www.labor.maryland.gov/finance/industry/moneytran.shtml
- OCC GENIUS Act final rule, 2026-10-21: https://occ.treas.gov/news-issuances/bulletins/2026/bulletin-2026-50.html

Se recomienda registrar cada decisión en acta y no etiquetar documentación interna como licencia. Mantener la solicitud de cambios en borrador hasta revisión humana.
