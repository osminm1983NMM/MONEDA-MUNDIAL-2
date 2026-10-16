# Moneda Mundial Coin — seguridad de billeteras y ruta de testnet
Fecha: 16 de octubre de 2026. **Únicamente investigación.**

## Verificación del paso anterior
El workflow «Contrato Coin abstracto (solo investigación)» terminó **success** en el commit `154ff032`. Verifica que compila Solidity y que el contrato es ABSTRACTO y no produce bytecode desplegable. No implica auditoría de seguridad ni emisión.

## Diseño de billeteras
**Regla actual:** no solicitamos, recibimos ni almacenamos frases semilla, claves privadas, contraseñas ni firmas en la app o el repositorio. No se ha creado ninguna billetera. El nuevo módulo `src/digital-money/watch-only-wallet-policy.mjs` permite estudiar direcciones EVM de **Base Sepolia** (chain ID 84532) para futura observación sin conexión a RPC, sin saldo ni operaciones reales.
- Sólo se aceptan direcciones públicas hexadecimales no nulas, en minúsculas o mayúsculas; se rechaza el formato mixto hasta integrar verificación completa de checksum EIP-55. No inferir propiedad de la dirección ni que una dirección válida sea segura para recibir.
- Se rechazan claves/semillas explícitas y campos inesperados.
- No se guardan direcciones ni identificaciones en Supabase.
- Se bloquea Ethereum mainnet (1) y Base mainnet (8453). Sin firma, despliegue, monedas, pagos o acceso a dinero.
- Una pantalla de «observar» nunca debe mostrar saldo ficticio como token real ni enviar transferencias.

## Peligros que se deben resolver antes de una billetera con activos
1. Modelo de custodia: auto-custodia, custodio regulado o híbrido, recuperación y pérdida irreversible de claves.
2. KYC/AML/sanciones y acceso por jurisdicción para operaciones de intercambio y custodia; políticas de protección al consumidor.
3. Pantallas antiphishing: dominio/red/contrato verificables, revisión antes de firmar, avisos sobre aprobaciones `approve` y contratos maliciosos.
4. Seguridad móvil: almacenamiento en hardware seguro, aislamiento de sesión, MFA para administradores, pérdida de teléfono, malware, SIM swapping y medidas de fraude.
5. Controles en blockchain: suministro máximo, distribución, vesting, permisos de acuñación, owner/multifirma, timelocks, auditoría y monitoreo.
6. Ejecución Coin⇄Digital: emisor real de stablecoin, liquidez comprobada, slippage, tarifas, impuestos, liquidación atómica y conciliación independiente.
7. Nunca colocar claves API, seed phrases, private keys ni secretos de RPC en repositorios, registros, chats o mensajes de soporte.

## Próximos hitos verificables
- Especificar modelo de amenazas y revisar contratos independientes.
- Estudiar estándares de billetera / EIP-1193 y EIP-55 sin conectar todavía wallets.
- Crear prototipo CONCRETO en testnet **solo después** de aprobar economía, controles y alcance regulatorio; el prototipo actual continuará abstracto.
- Preparar seguridad del flujo de compra comercial, cotización transparente y diferencia entre créditos demo, Coin y Digital.
- En paralelo continuar: empresa, proveedores regulados, licencias por corredores, primera remesa US→HN; NI y catálogo mundial intactos.

Referencias: https://docs.base.org/ ; https://eips.ethereum.org/EIPS/eip-55 ; https://eips.ethereum.org/EIPS/eip-1193 ; https://docs.openzeppelin.com/contracts/5.x/erc20
