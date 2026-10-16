# Conciliación por eventos y auditoría de prueba — Moneda Mundial 2.0
16 octubre 2026. Estado: INVESTIGACIÓN; no es conciliación bancaria auténtica.

## Trabajo incorporado
- `src/server/mock-transfer-reconciliation.mjs`: comparación entre propuestas contables DE PRUEBA generadas por el ciclo de remesas y filas de extracto introducidas a mano (también ficticias).
- Compara referencia de operación, moneda USD, importes y fase: fondeo, desembolso o devolución.
- Reconoce faltantes, registros duplicados, discrepancias y eventos ajenos; coloca la operación bajo revisión manual de ejemplo.
- Exige exclusión entre pago al beneficiario y reembolso final.
- Cadena hash SHA256 de eventos de auditoría ficticios EN MEMORIA para detectar modificaciones en un conjunto de eventos revisado; **no** representa registro inmutable ni prueba bancaria/legal. No guarda identidades ni extractos personales.
- `tests/mock-transfer-reconciliation.test.mjs`: casos US→HN y US→NI, alteraciones, duplicaciones, reembolso y auditoría.

## Advertencias / límites
`matched_mock` sólo significa que dos grupos de **fixtures sintéticos** coinciden. NO significa acreditación bancaria, liquidación efectiva, cumplimiento regulatorio, ni permite ejecutar pagos.
No existe consulta a proveedores, base de datos de producción, cuenta bancaria, wallet real, stablecoin ni Moneda Mundial Coin emitida. No es admisible transferir saldo desde estas pruebas a personas o comercios.

## Bloqueantes para servicio auténtico
1. Entidad jurídica, contratos y autorizaciones de transmisiones por corredor, KYC/AML/OFAC y protección consumidor.
2. Proveedores regulados de fondeo y desembolso con API sandbox documentada.
3. Identidad y firma auténtica de eventos, segregación de roles, idempotencia persistente, colas, locks y seguimiento de eventos fuera de orden.
4. Conciliación real con extractos independientes, saldo inicial/corte y referencias de liquidación verificables; revisión humana y reversos auditados.
5. Auditoría externa, gestión de incidentes, continuidad de operaciones, protección de datos, límites y antifraude.
6. Moneda Mundial Digital estable y Coin variable permanecerán separadas en custodia, contabilidad y regulación.

**Próximo componente recomendado:** mapeador de eventos documentados de proveedor a estados internos y detección de discrepancias antes de habilitar cualquier dinero verdadero. Honduras primera ruta candidata, Nicaragua y catálogo mundial permanecen a nivel de diseño.
