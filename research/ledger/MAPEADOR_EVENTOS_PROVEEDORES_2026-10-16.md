# Conectores financieros: normalización de eventos — investigación
16 octubre 2026.

## Lo completado
- Se corrigió el validador de integridad del historial SHA256 en memoria que hacía fallar una de las 96 pruebas anteriores. El fallo era que no reconocía los metadatos `previousHash` y `hash` del evento revisado, no que exista una transacción financiera manipulada. Hay nuevas verificaciones CI.
- Se creó `src/server/mock-provider-event-mapper.mjs` y pruebas `tests/mock-provider-event-mapper.test.mjs`: contratos de datos inventados para dos proveedores abstractos, separados por estados de **fondeo**, **desembolso** y **reembolso**.
- El mapeador rechaza eventos de países no configurados, campos inesperados, operadores no integrados, cantidades inválidas, estados desconocidos y modo producción.
- La bandera de autenticidad es un dato controlado por el LABORATORIO: NO supone firma real comprobada. Todos los eventos producen `balanceCreditAllowed=false`, `realMoneyEnabled=false` y `realProviderConnected=false`.

## Próximo paso condicionado a un proveedor externo
1. Entidad jurídica y acuerdos de servicio/participación regulada para ruta US→HN; NI y 249 destinos sólo catálogo de planificación hasta habilitación individual.
2. Conseguir especificación oficial y credenciales de **sandbox del proveedor autorizado**, nunca credenciales reales en GitHub.
3. Mapear estados originales documentados del proveedor, incluyendo diferencias entre aceptación del envío, autorización de fondeo, liquidación irrevocable, inicio de desembolso y entrega final.
4. Recibir eventos en backend privado con firma validada, persistencia transaccional y protección por emisor+event ID, referencias/importe/moneda/coincidencia, TTL y comprobación independiente del extracto.
5. Implementar ledger ACID real con reconciliación y revisión humana de anomalías sólo tras revisión jurídica, seguridad y piloto autorizado.
6. Nunca asumir que `transfer_completed` prueba fondeo bancario; ni que `matched_mock` equivalga a entrega real.

**Estado:** arquitectura preliminar y pruebas locales/CI; no hay proveedor contratado ni transferencias reales. Los tokens Moneda Mundial Coin y el instrumento Moneda Mundial Digital tampoco están emitidos.
