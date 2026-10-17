# Moneda Mundial 2.0 — Evidencia por proveedor financiero (solo DEMO)

**Fecha:** 17 de octubre de 2026. **Estado:** evaluación documental de proveedores candidatos, sin conexión productiva ni autorización financiera.

## Riesgo corregido
Un expediente de la ruta `US:HN:USD:HNL:cash_pickup` no debe marcarse completo por incluir documentos de otra institución, aunque país, método y moneda coincidan. Las anotaciones internas tampoco pueden sustituir la evidencia externa de licencias ni un acuerdo firmado.

## Contrato interno del evaluador
`assessProviderCorridorDiligence({ candidateProviderId, corridor, evidence, asOf })`

- `candidateProviderId` es un identificador opaco sin datos personales, de 8 a 80 caracteres alfanuméricos/guion/guion bajo/punto. Es obligatorio.
- El `scope` de cada evidencia combina `candidateProviderId:paísOrigen:paísDestino:monedaOrigen:monedaDestino:método`.
- Los registros deben tener exactamente `scope`, `reference`, `source`, `reviewedOn`, `expiresOn`.
- Una referencia no es prueba de autenticidad. El validador comprueba solo estructura, fechas y concordancia declarada.
- El requisito de licencias de origen y destino y el de red de retiro en efectivo solo acepta `regulator_record` como fuente documental declarada.
- Los requisitos de contrato del proveedor, custodia/liquidación y matriz KYC/AML solo aceptan `signed_contract` como fuente declarada.
- Los demás requisitos aceptan `provider_documentation`, `signed_contract` o `regulator_record`. `internal_policy` no acredita por sí solo un requisito externo.
- Es obligatorio verificar de forma independiente que el documento proviene realmente del regulador o la contraparte y cubre la institución, jurisdicción, modalidad, fechas y servicio requeridos.

## Invariantes de seguridad
**Incluso con el expediente declarado completo, el resultado NO desbloquea** `realPaymentsEnabled`, `canMoveMoney`, `canHoldCustomerFunds`, `canRedeemPickupCode`, `canQuoteRealFx`, `partnerContractVerified` ni `legalLaunchApproval`.

Las pruebas usan referencias ficticias y nunca deben usarse como registros legales. No publicar nombres de beneficiarios, números de cuentas, claves ni documentos personales en repositorios.

## Ámbito internacional
US→HN se usa como ejemplo de pruebas; Nicaragua y los demás países siguen siendo candidatos de diseño. Cada nuevo país, proveedor, red de pago o modalidad exige su propia comprobación legal y financiera independiente.

## Validación
`node --test tests/provider-corridor-diligence.test.mjs` y `node --test tests/*.test.mjs` en la CI aislada; no llamar API de un proveedor ni modificar Supabase durante estos ensayos.
