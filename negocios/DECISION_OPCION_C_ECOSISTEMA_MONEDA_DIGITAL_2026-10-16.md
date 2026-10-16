# Moneda Mundial 2.0 — decisión de arquitectura «Opción C»
**Fecha:** 16 de octubre de 2026  
**Decisión conceptual del fundador:** mantener bajo la marca Moneda Mundial **dos activos diferenciados**: (1) instrumento estable para pagos, y (2) una criptomoneda propia de precio variable que aspire a permitir transferencias entre personas y comercios, *similar en funcionalidad abierta a Bitcoin*.  
**Estado:** ESTUDIO Y DISEÑO. NO se ha emitido, acuñado, reservado, ofrecido ni vendido ningún token; NO existe precio, oferta máxima ni fecha de lanzamiento aprobados.

## 1. Organización: mismo ecosistema, subproyecto separado
- **Una sola marca/aplicación móvil:** Moneda Mundial, con selector de países para todos los 249 destinos de diseño (Honduras primer corredor candidato real, Nicaragua y los demás permanecen). Un país visible nunca implica habilitación regulatoria.
- **Servicio 1 — Remesas y dinero fiat:** cuentas, envíos y retiros mediante contrapartes reguladas por corredor; libro mayor propio y conciliación de proveedor.
- **Servicio 2 — Pago estable:** estudiar integración de **stablecoin emitida por un tercero autorizado** o emisión propia sólo después de evaluar licencias, redención, reservas, AML/KYC, auditorías y GENIUS Act. Nombre de trabajo «MWD-USD», no definitivo; 1 unidad aspiraría a 1 USD conforme a términos del emisor. NO puede venderse a USD 0.10 con promesa de redención inmediata a USD 1.
- **Servicio 3 — Criptoactivo nativo variable:** «MWD Coin» (denominación provisional, símbolo sujeto a validación); token con oferta/protocolo previamente definidos, posible pago directo a comercios y transferencia entre billeteras según leyes. **Sin precio fijo ni expectativa/promesa de subida**. Su titular puede perder todo el capital. La emisión/oferta no nace simplemente de tener una interfaz.
- **Servicio 4 — Mercado y cotizador multimoneda:** mostrar precio del producto original, tipo de cambio con fuente y hora, comisión, diferencial, impuesto aplicable, cotización token, total pagado y neto recibido; comerciantes deciden precio y activos aceptados. Una criptomoneda no convierte por sí sola USD 3.00 a USD 2.75.
- **Aislamiento:** inventarios, cuentas, balances, custodia, llaves criptográficas, contabilidad y controles de riesgo separados. Créditos DEMO existentes `MWD` nunca convertibles a instrumentos reales. No usar el mismo ticker sin etiquetas explícitas en UI.

**Propuesta de repositorios:** permanecer en este repositorio sólo con especificaciones e interfaces ficticias durante la evaluación. Si se aprueba el desarrollo de criptoactivos reales, crear **proyecto técnico/repositorio separado** para smart contracts, auditorías, pruebas y gobernanza del token; integración por API/adaptador desde la app principal. Esta separación evita que un error de token comprometa las remesas. La estructura jurídica/empresa emisora puede necesitar separación adicional según dictamen profesional.

## 2. Decisiones económicas: emisión no es precio de mercado
- **Precio variable:** el comprador/vendedor determina el precio efectivo mediante liquidez y oferta/demanda en plataformas permitidas; nadie puede asegurar USD 0.10 de salida ni USD 1.00 futuro. Un precio inicial de USD 0.10 sería hipotética **oferta primaria** si se autorizase, NO cotización de mercado ni precio garantizado.
- **Cantidad / política monetaria:** no la establece «el mundo» automáticamente. Debe codificarse una política transparente, por ejemplo máximo fijo (como concepto, no copiar cantidades de Bitcoin), emisiones preestablecidas, calendario y reglas de cambios de protocolo/governance; todo sujeto a análisis de incentivos, concentración, distribución y auditoría. Si se pretende verdadera descentralización, estudiar distribución justa, control de claves, privilegios de acuñación, permisos, validadores, gobernanza y posibilidad de censura.
- **Escasez no garantiza valor:** una cantidad limitada sin utilidad, liquidez y adopción puede valer cero. No afirmar ganancias/competitividad frente a dólar o euro.
- **Stablecoin:** su oferta puede crecer/decrecer por demanda **sólo contra emisión/redención autorizada y reservas correspondientes**; su precio objetivo es estable, no apreciación especulativa.
- **Ejemplo:** mercancía equivalente a USD 2.75 antes de cargos costaría 2.75 unidades de estable a 1 USD o 27.5 tokens de mercado a USD 0.10. Si el vendedor exigiera USD 3, la conversión por sí sola no crea descuento.

## 3. Reglas regulatorias y operativas (Estados Unidos, 2026)
- GENIUS Act establece un régimen de emisión de stablecoins de pago por emisores permitidos y requisitos de reserva/redención; el OCC publicó propuestas de implementación en 2026. Confirmar vigencia y exigencias específicas al lanzar.
- SEC/CFTC (interpretación de marzo de 2026): clasificación de activos digitales y análisis de contratos de inversión; el diseño y **modo de oferta** del token pueden imponer obligaciones de valores, aun si el activo en sí no se considera valor en toda circunstancia.
- FinCEN: quien administre/intercambie moneda virtual convertible o transmita valor podría requerir cumplimiento de money transmission/BSA/AML y licencias estatales según rol. Revisar sanciones OFAC, consumer protection, impuestos y normas del país de destino.
- IRS: disponer de criptomoneda para pagar bienes o servicios puede ser un hecho fiscal imponible y requiere registros adecuados.
- No captar dinero, admitir depósitos para tokens, ejecutar preventa, generar activos con valor real, emitir stablecoin, prometer liquidez ni admitir inversores mientras la viabilidad jurídica y financiera no esté validada.

**Fuentes oficiales:**
- SEC interpretativa 2026: https://www.sec.gov/rules-regulations/2026/03/s7-2026-09
- OCC implementación GENIUS: https://www.occ.gov/news-issuances/bulletins/2026/bulletin-2026-3.html
- FinCEN convertible virtual currencies: https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-persons-administering
- IRS activos digitales: https://www.irs.gov/es/filing/digital-assets

## 4. Plan de implementación, no lanzamiento de moneda
**Fase A (ahora):** continuar primer corredor real de remesas US→HN y mantener el catálogo global; desarrollar comparador de precios PEN/USD/HNL y vista conjunta de diferentes unidades sin compras reales.
**Fase B:** estudio jurídico y económico independiente del token: objetivo de utilidad, jurisdicciones, whitepaper, riesgos, oferta máxima *por decidir*, calendario, distribución, gobernanza, cadena propia versus token en cadena auditada, liquidación/FX y custodia.
**Fase C:** estudiar integrar stablecoin de **tercero autorizado** primero, sujeto a contratos y viabilidad. No proyectar emisión propia sin fundamento financiero.
**Fase D:** sólo con asesoría, auditorías y aprobaciones, implementar smart contracts en repositorio independiente y testnet, pilotos sin valor real, posibilidad futura de circulación sujeta a autorizaciones. Mercado/venta quedan separados y condicionados.

### Puertas de decisión
1. Confirmar alcance regulatorio de emisión, comercio, intercambio, custodia y pagos.
2. Definir oferta y política monetaria objetiva, concentración, derechos del titular y capacidad de gobernanza; publicar código auditado.
3. Elegir entidad responsable, reserva/redención para estable y proveedores de liquidez para variable.
4. Revisar auditoría tecnológica y protección de claves.
5. Obtener aprobación formal para operar por corredor, moneda y método. 

**Conclusión:** NO crear dos aplicaciones que confundan usuarios ni mezclar sus saldos. SÍ crear en el mismo ecosistema Moneda Mundial un **subproyecto criptográfico con desarrollo, controles, finanzas y evaluación legal independientes**. La política de emisión se programa y gobierna de forma transparente; el mercado determina el precio variable; ninguno de los dos garantiza rentabilidad o adopción.

## Implementación inicial — 16 de octubre de 2026
- Módulo independiente `src/digital-money/design-and-comparison.mjs`: clasificación de tres saldos/activos, todos deshabilitados para compra y venta; no hay paridad, ticker, oferta ni precio de lanzamiento.
- Pantalla `DigitalMoneyConceptScreen.js` desde menú principal de Android; cálculo puramente manual de equivalencia de precio local/US dólar y escenarios hipotéticos de monedas digitales. No consulta mercados ni acepta fondos.
- Pruebas `tests/digital-money-design.test.mjs` para impedir ventas y verificar cálculos. Pendiente de resultado CI al momento de registrar.
- **Próximos requisitos:** estudiar tokenomics, whitepaper preliminar, cadena de testnet, requisitos de emisor de moneda estable y contratos de cotización de terceros. No iniciar una venta ni usar saldo MWD demo como moneda real.
