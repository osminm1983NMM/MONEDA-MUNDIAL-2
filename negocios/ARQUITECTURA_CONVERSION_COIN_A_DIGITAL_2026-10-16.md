# Arquitectura de Moneda Mundial Digital ⇄ Moneda Mundial Coin
16 octubre 2026 — especificación inicial de **diseño**, no producto emitido.

## Nombres aprobados para trabajar
- **Moneda Mundial Digital**: componente de pago con valor estable como objetivo (idealmente interoperando con stablecoin de un emisor regulado; sin emisor ni paridad aprobados).
- **Moneda Mundial Coin**: proyecto independiente de criptoactivo de precio **variable**, aún sin emisión, oferta máxima, precio, blockchain ni ticker seleccionados.
- **MWD de prueba** en Supabase: puntos de demostración, sin equivalencia ni conversión a ninguno de los dos.

## Flujo deseado (CONDICIONAL)
1. Usuario posee Coin genuina en billetera permitida, con saldo confirmado.
2. Plataforma obtiene cotización **ejecutable** COIN/Digital desde un servicio autorizado con liquidez; precio, hora, spread, gastos de red y slippage visibles.
3. Usuario ve cantidad exacta estimada de Digital, límite mínimo a recibir, caducidad, comisiones, impuestos y riesgos.
4. Usuario consiente operación; se verifican identidad, sanciones, jurisdicción y límites.
5. Intercambio atómico mediante protocolo auditado o ejecución custodial autorizada, nunca transfiriendo una moneda sin confirmar entrega de la otra.
6. Se concilia el resultado, comprobante y recibo, con protección contra transacciones duplicadas y reversión operativa cuando aplique.
7. Digital puede conservarse o utilizarse para pagar solamente donde esté permitido y aceptado; redención y reserva son responsabilidad contractual del emisor autorizado.

## Ejemplo — números completamente HIPOTÉTICOS
Si una Coin valiera USD 0.25 y Digital tuviera valor de USD 1.00, **10 Coin equivaldrían aritméticamente a 2.50 Digital** antes de comisiones y deslizamiento. Si el valor Coin fuera 0.05, diez unidades sólo equivaldrían a 0.50 Digital. Si la moneda estable perdiera temporalmente paridad, deben mostrarse precios efectivos y riesgos, no asumir valor fijo.
Una ganancia de valoración de Coin no significa efectivo garantizado: requiere liquidez, venta ejecutada, tarifas e impuestos aplicables.

## Seguridad / infraestructura
- Contratos y auditoría de token de valor variable deben vivir en un repositorio separado del backend de remesas y la UI.
- Stablecoin de tercero autorizado: verificar emisor, reservas, redención, derecho del titular y disponibilidad geográfica. No emitir stablecoin propia automáticamente.
- Backend cotizador separado y con credenciales privadas. Garantizar consistencia de blockchain/red y dirección de token/contrato verificada, protección contra swaps maliciosos, MEV/price manipulation, decimales, fallos de liquidación, claves, doble gasto y dirección errónea.
- No confiar en supuestos de tipo de cambio 1:1, montos recibidos, valor de reserva o listas de tokens enviados por cliente.
- Usar el precio de mercado observable de proveedores cuando existan; no comprometer un precio inicial arbitrario Coin.
- Moneda Mundial Digital no implica que Moneda Mundial sea emisora. Nombre es denominación de experiencia de producto, no un activo legal propio aprobado.

## Implementación actual
- `src/digital-money/coin-to-digital-design.mjs`: solo comparador con precios manuales de escenario, matemáticas exactas BigInt, redondeo conservador, sin transacciones, fees reales, mercados ni cotización ejecutable.
- `DigitalMoneyConceptScreen.js`: vista informativa + escenario COIN→Digital.
- `tests/coin-to-digital-design.test.mjs`: comprueba escenarios y prohíbe prometer ejecución.
- Sin token real, sin billeteras blockchain reales, sin stablecoin contractual, sin liquidez y sin transmisión de valor.

Referencias técnicas:
- https://docs.openzeppelin.com/contracts/5.x/erc20
- https://docs.uniswap.org/contracts/v3/guides/swaps
- https://docs.base.org/
- https://www.irs.gov/filing/digital-assets

**Regla de avance:** sólo convertir monedas reales después de definir instrumento, red, emisor, mercado, liquidez, permisos legales, seguridad independiente y autorización del usuario.
