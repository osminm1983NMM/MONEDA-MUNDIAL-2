# Moneda Mundial Coin — primer estudio económico y tecnológico
**Fecha:** 16 oct 2026. **Estado:** investigación y simulación, sin token emitido, sin venta, sin precio inicial establecido y sin contrato financiero.

## Diseño económico: alternativas abiertas
La cantidad de monedas **sí necesita una regla predefinida de protocolo**; no surge espontáneamente del precio de mercado. El fundador ha decidido que **el precio no será fijado ahora**: compradores y vendedores podrían determinarlo cuando exista mercado líquido y autorizado, sin garantía de valor o crecimiento. Nunca confundir con saldo ficticio MWD ni con una stablecoin.

**Escenario 1, oferta inicial fija:** se acuñaría un total hipotético y el contrato impediría futuras emisiones; riesgos: concentración, pérdida de claves, manipulación del mercado y falta de liquidez. Ninguna cantidad propuesta es oficial.

**Escenario 2, emisión preprogramada con máximo:** calendario, techo y reglas codificados, auditables y resistentes a cambios unilaterales. Riesgos: privilegios de gobernanza, cambios de contrato, recompensas, inflación y complejidad.

**Para ambos:** decidir tokenomics con modelos de unidades, asignaciones a comunidad, ecosistema, equipo y reserva; vesting, divulgación pública de tenencias, derechos del titular y protección de compradores. La oferta máxima no determina ni garantiza precio alguno.

El módulo `src/digital-money/tokenomics-scenarios.mjs` permite comparar escenarios arbitrarios y conserva precios, emisiones reales y ventas **deshabilitados**. No hay token existente ni ticker definitivo.

## Redes candidatas para estudio — decisión técnica pendiente
| Alternativa | Ventajas a evaluar | Riesgos/condiciones pendientes | Decisión |
| --- | --- | --- | --- |
| Red EVM compatible de costo menor (p.ej. Base) | Estándares ERC-20 y librerías OpenZeppelin, herramientas y testnet | Contratos, permisos de emisión, tarifas variables, puentes, MEV, custodia, dependencia de L2, auditoría | Investigar primero |
| Ethereum principal | Ecosistema y composabilidad conocidos | Gastos por transacción que podrían ser altos para tomates u otras compras pequeñas | Investigar |
| Solana | Tokens y programas de token, capacidades de rendimiento | Modelo de autoridades, wallets, auditabilidad, UX, gestión de claves y herramientas diferentes a EVM | Alternativa |
| Blockchain propia | Reglas de consenso propias | Validadores, seguridad de red, ataques, costos operativos, mantenimiento y adopción | **No recomendada inicialmente** |

**No se escogió blockchain.** Tampoco se desplegó smart contract a mainnet/testnet ni se crearon wallets o tokens.

## Reglas mínimas de seguridad antes de tocar una testnet
1. Repositorio separado para contrato; sólo usar librerías conocidas y dependencias fijadas y auditadas, sin guardar secretos.
2. Especificar máxima oferta, distribuciones y vesting; decidir si hay administrador, funciones de pausa, congelación o upgrade y revelar claramente estos poderes.
3. Definir gobernanza y control de llaves (multifirma, recuperaciones, rotación, separación de funciones, proceso de emergencia).
4. Pruebas de propiedad, invariantes de suministro, fuzzing, simulaciones con eventos, auditoría externa y licencias claras.
5. Análisis legal de emisión, oferta, exchange, custodia, valores, KYC/AML/OFAC, tributación y aceptación en cada país.
6. Evitar promesas de mercado, liquidez, tipo de cambio o distribución «justa» sin pruebas y evidencia; documentar restricciones legales por corredor.
7. Para comercio: referencia de precio independiente y reciente, tarifas y aceptación explícita del vendedor; devaluación y volatilidad siempre visibles.
8. Moneda estable: evaluar en módulo distinto una stablecoin ya emitida por institución permitida; no emitir la propia sin régimen de reservas, redención y auditorías.

## Próxima decisión de ingeniería
Primero elaborar **especificación de contrato ERC-20 sin despliegue** para estudiar un prototipo en testnet y compararlo con Solana. Las reglas de suministro continuarán indecisas. Mantener en paralelo las cuatro tareas de remesas reales: entidad jurídica, proveedor regulado, cumplimiento y backend bancario.

**Referencias técnicas públicas:** 
- OpenZeppelin ERC-20: https://docs.openzeppelin.com/contracts/5.x/erc20
- Base guía de despliegue y testnet: https://docs.base.org/
- Solana Token Extensions: https://solana.com/docs/tokens/extensions
- Ethereum L2: https://ethereum.org/en/layer-2/
- SEC interpretación de criptoactivos: https://www.sec.gov/rules-regulations/2026/03/s7-2026-09

**Todos los números de simulación son matemáticos, no precios, ofertas, emisión, compras ni saldos.**
