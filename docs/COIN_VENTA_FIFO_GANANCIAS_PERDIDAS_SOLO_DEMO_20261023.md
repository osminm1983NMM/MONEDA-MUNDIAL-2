# Moneda Mundial Coin · control de venta secundaria y ganancia/pérdida (SOLO DEMO)

23 de octubre de 2026. **No existe token emitido, mercado conectado, conversión real a Digital, cotización fiable ni dinero liquidado**.

El nuevo módulo `src/digital-money/mock-coin-fifo-sale.mjs` simula ventas de Coin ya asignadas a titulares ficticios independientes. No vende activos de la compañía ni permite que la tesorería se apropie de Coin de usuarios.

Los lotes sintéticos tienen un costo de adquisición por unidad. La venta usa FIFO (el lote más antiguo primero) para un **resultado educativo**, nunca para asesoría fiscal ni una determinación de bases tributarias reales. Precio, comisiones y capacidad de compradores son valores introducidos *sólo en el fixture local del servidor*, no datos de un exchange.

- La cotización muestra Coin a vender, precio hipotético, ingreso bruto, comisión, importe neto, costo histórico estimado y ganancia/pérdida ilustrativa. Además señala que impuestos, spread y comisiones de red no están incluidos.
- Exige mínimo neto y aceptación expresa de términos antes de la simulación; caduca a los 120 segundos.
- Un cambio de precio o de cartera entre cotización y confirmación rechaza la operación; debe obtenerse una nueva cotización con una nueva referencia.
- Idempotencia: un mismo `requestId` y `quoteId` nunca duplican el movimiento. Una segunda venta de igual tamaño y precio dentro de 10 minutos requiere confirmación separada.
- Conserva el total de unidades Coin inventadas sumando cartera de vendedores y tenencias de contraparte del laboratorio.
- No recibe ni entrega USD, no registra balances contables reales, no transfiere blockchain y no opera con Moneda Mundial Digital.

Requisitos pendientes: emisor/operador autorizado según el régimen aplicable, revisión SEC/CFTC y FinCEN/estados, KYC/AML/OFAC, mercado y precios verificables, liquidez y custodia, persistencia e idempotencia transaccional, auditoría independiente, divulgación integral de tarifas y riesgos, cálculo fiscal y reglamentos de atención al consumidor. Moneda Mundial Digital requiere evaluación de emisor de stablecoin aparte.

Pruebas: `node --test tests/mock-coin-fifo-sale.test.mjs`. No conectar a una API pública ni fusionar sin revisión.