# Arquitectura técnica de Moneda Mundial Coin — prototipo ERC-20 abstracto
Fecha: 16 octubre 2026. Estado: **ESTUDIO TÉCNICO, NO DESPLIEGUE NI EMISIÓN.**

Se creó una carpeta aislada `research/coin-contract/` para explorar Ethereum Virtual Machine (EVM). El archivo `contracts/MonedaMundialCoinResearch.sol` es **abstracto**, no desplegable. Ilustra la hipótesis de una emisión fija al construir un futuro contrato, **sin seleccionar oferta, precio, divisa, red, dueño, venta o calendario**. Utiliza la interfaz ERC-20 de OpenZeppelin bajo una versión específica, pero este código no es una moneda creada ni una prueba suficiente de seguridad.

## Invariantes
- Estándar ERC-20 únicamente como punto de partida de investigación.
- Sin funciones públicas de acuñación adicional, compra, venta, recuperación de paridad, congelación o upgrade.
- No usar monedas `MWD` ficticias actuales como inventario ni respaldo de Coin.
- Los nombres y ticker utilizados en el estudio no son denominaciones definitivas de activos existentes.
- `Moneda Mundial Digital` (valor estable deseado) será un producto separado cuyo emisor, respaldos y derechos deben verificarse; NO se emite en este repositorio.
- El intercambio Coin⇄Digital sigue como simulación matemática, sin exchange, liquidez ni claves de terceros.

## Pruebas creadas
- Compilación aislada con `solc` y OpenZeppelin desde una carpeta ajena a la app Expo.
- Verificación de que no existe bytecode de contrato concreto desplegable.
- Comprobación de funciones ERC-20 fundamentales y ausencia de funciones de emisión y comercio.
- GitHub Actions `verificar-coin-investigacion.yml`: nunca envía transacciones, ni usa wallet, redes, claves, secretos, fondos o APIs de blockchain.

## Próximas decisiones ANTES de testnet
1. Contrastar alternativas de oferta fija vs emisión programada y gobernanza; estudio económico, derechos, distribución, vesting y concentración.
2. Selección de red de pruebas e investigación de riesgos de Ethereum/Base/Solana, costos, interoperabilidad y custodia.
3. Crear entorno experimental en repositorio dedicado una vez aprobado el plan técnico y regulatorio.
4. Pruebas fuzz, auditoría, formalización de límites de acceso, seguridad de llaves y código abierto; revisión jurídica de emisión, operaciones, sanciones y tributación.
5. Separar arquitectura del futuro instrumento estable: investigar un emisor regulado con reservas y redención antes de conectar saldo o intercambio.
6. Mantener trabajo paralelo de primeras remesas reales US→HN y catálogo mundial que conserva Nicaragua y demás países.

**Criterio para continuar:** La finalización de CI de este prototipo sólo indica que la sintaxis del diseño y sus invariantes básicas pasan. NO otorga permiso para emitir tokens, venderlos o promocionar rentabilidad.
