# Moneda Mundial 2.0 — evaluación inicial y selección CONDICIONAL de proveedores
**Fecha de investigación:** 16 de octubre de 2026 · **Corredor candidato:** EE. UU. (USD) → Nicaragua.  
**Alcance:** información pública oficial y relevancia preliminar. No hay llamadas a proveedores, respuesta de ventas, cuentas registradas, credenciales sandbox, contrato, autorización, pago real ni due diligence de licencias finalizada.

## Decisión de esta etapa
1. **TerraPay — PRIMER CONTACTO PRIORITARIO para depósito a cuenta bancaria.** Evidencia específica publicada del corredor EE. UU. → Nicaragua y alianza Banpro anunciada en abril 2026. **No existe evidencia de que ese programa permita cash pickup, que acepte hoy a Moneda Mundial ni que cubra a cualquier banco o remitente**. Su portal describe incorporación condicionada a acuerdos comerciales, revisión de corredores y credenciales después del proceso.
2. **Thunes — SEGUNDO CONTACTO PRIORITARIO para explorar cash pickup sin teléfono.** Documentación v2 confirma que su API soporta, *en algunos pagadores/países*, Cash Pickup, cuentas, tarjetas y billeteras, y tiene preproducción. **No encontramos confirmación pública de cash pickup en Nicaragua ni de fondeo desde EE. UU. para Moneda Mundial**. Un flujo documentado para otro país NO demuestra que exista en Nicaragua.
3. **Nium — TERCER CONTACTO/RESPALDO para transferencias bancarias.** Su catálogo público Nicaragua expone **Foreign currency wire transfer (SWIFT)** y no muestra cash pickup nicaragüense. Puede ser técnicamente útil como alternativa de transferencia internacional, pero la ficha pública también indica 'Beneficiary account type: CORPORATE'; por tanto, NO demuestra que el flujo P2P a un beneficiario particular sea elegible, además de no satisfacer retiro sin teléfono. Su documentación general dice cash pickup en *algunos países*, sin probar Nicaragua.

**Estas son prioridades de investigación, NO selección de proveedor contratado ni permiso de operar.** Si el retiro sin app es condición absoluta del primer lanzamiento, actualmente **ningún candidato está validado** para las dos modalidades a la vez.

## Evidencia concreta y limitaciones
| Empresa | Evidencia oficial comprobada | Qué NO demuestra / pendientes |
| --- | --- | --- |
| TerraPay | Comunicado 28 abril 2026: TerraPay–Banpro anuncia remesas desde EE. UU., Costa Rica, España y Panamá **a cuentas de Banpro en USD** en Nicaragua; portal con sandbox/UAT/live tras onboarding y corredor sujeto a aprobación | No demuestra cash pickup a personas sin cuenta; no demuestra aceptación de una fintech pre-LLC, tarifa, contrato o licencias que cubran a nuestra empresa |
| Thunes | Money Transfer API v2 describe pagos a bank, card, mobile wallet y Cash Pickup, además de discovery de pagadores, cotización, envío, confirmación y preproducción | No demuestra pagador cash pickup NI, fondeo USD desde EE. UU., agente de cobro sin smartphone ni tarifas concretas |
| Nium | Payouts tiene cobertura global; ficha pública **Nicaragua**: transferencia internacional SWIFT con monedas USD/EUR/etc. Catálogo de ruta no indica cash pickup en NI | No equivale a depósito local ACH ni entrega en efectivo; la ficha pública indica 'Beneficiary account type: CORPORATE' aunque lista P2P entre modos; hay que aclarar esa discrepancia con ventas y confirmar destinatario persona física, banca emisora, costos y elegibilidad de EE. UU. |

### Enlaces de evidencia original
- TerraPay / Banpro (28 abril 2026): https://www.terrapay.com/media/terrapay-banpro-remittances-nicaragua/
- TerraPay red / Nicaragua: https://www.terrapay.com/network/
- TerraPay developer onboarding / acceso condicionado: https://developers.terrapay.com/getStarted.html
- TerraPay contacto oficial: https://www.terrapay.com/connect/
- Thunes Money Transfer API v2: https://docs.thunes.com/money-transfer/v2/
- Nium Nicaragua catálogo público: https://atlas.nium.com/country/nicaragua
- Nium descripción Payouts: https://docs.nium.com/docs/payouts
- Nium developers/sandbox: https://www.nium.com/developers

## Preguntas de descarte prioritarias (requerir respuesta escrita)
**Para todos:**
1. ¿Aceptarían una fintech fundada en EE. UU., actualmente en preconstitución, para **consulta preliminar**, y cuáles son mínimos de capital, constitución y KYB?
2. ¿Qué persona jurídica es responsable, en el contrato propuesto, de iniciar remesas P2P desde EE. UU., recibir dinero, custodia/segregación, compliance y reembolsos? ¿Qué registros/licencias le aplican a Moneda Mundial por estado estadounidense?
3. ¿Está autorizado y soportado **US→NI para cliente P2P**, con fondeo por cuenta bancaria y/o tarjeta? ¿Qué monto mínimo/máximo, monedas, comisión total, FX, reservas y costos por chargeback?
4. ¿Se permite Nicaragua **cash pickup sin app/teléfono ni cuenta bancaria del beneficiario**, y en cuáles sucursales; quién genera el código, verifica documento e identidad, exige línea online y garantiza uso único?
5. ¿Se permite depósito bancario NI, en particular **Banpro USD**, y qué cuentas receptoras son elegibles?
6. ¿Hay credenciales de **sandbox oficial** después de evaluación, API documentada, firma/verificación de webhooks, reintentos idempotentes, payouts, cancelación, devolución y conciliación diaria?
7. ¿Cuáles contratos, SLA, costos de incorporación/volumen, mínimo de liquidación, plazo de disponibilidad y obligaciones AML/sanciones y de protección al consumidor?

**TerraPay:** confirmar si la alianza con Banpro anunciada públicamente está operativa para P2P en nuestro modelo; pedir detalles técnicos sin afirmar relación comercial con Banpro; preguntar expresamente cash pickup distinto del **depósito a cuenta** anunciado.

**Thunes:** solicitar **lista de payers NI** y si alguno brinda cash pickup presencial sin smartphone y acepta origen EE. UU.; verificar moneda y cobertura **antes** de priorizar integración.

**Nium:** confirmar por qué Nicaragua sólo indica **SWIFT wire** en su catálogo público y si existe una vía contractual distinta para retiro en efectivo; no asumir disponibilidad.

## Reglas de decisión y aprobación
- **Etapa 0 — shortlist:** TerraPay (depósito US→NI), Thunes (cash pickup global, país NI no comprobado), Nium (banca SWIFT NI). Completa.
- **Etapa 1 — RFI escrita:** respuesta de cobertura, modalidad, licencia/regulación exacta y requisitos de entidad. **PENDIENTE**.
- **Etapa 2 — KYB/contrato y opinión legal US+NI:** **PENDIENTE**. LLC por sí sola no permite transmitir fondos. La licencia de terceros no exonera automáticamente obligaciones.
- **Etapa 3 — sandbox oficial proveedor:** **PENDIENTE**. Sólo backend privado con secretos separados; no tocar las funciones demo para convertirlas en reales.
- **Etapa 4 — primera operación real:** **BLOQUEADA** hasta validaciones técnicas, bancarias, de fondos, KYC/AML, derechos de remesas, conciliación, auditoría y autorizaciones escritas.

## Cuatro frentes fundamentales (no olvidados)
1. **Constitución:** elegir estado/tipo de entidad con abogado/CPA, formar sociedad, EIN, cuenta empresarial, KYB.
2. **Proveedor:** TerraPay y Thunes primeras gestiones; Nium respaldo. Aún ninguna comunicación enviada.
3. **Cumplimiento:** determinación escrita por estados US y destino NI, MSB/transmisión, KYC/AML/sanciones, remesas, consumidores, privacidad.
4. **Tecnología:** seguir con mock aislado y controles antifraude; esperar sandbox autorizado para adaptar API real; libro mayor de partida doble y conciliación de producción aparte del saldo DEMO.

## Resultado ejecutivo
**Seleccionados para primera ronda de conversaciones: TerraPay y Thunes.**
**Proveedor para depósito bancario NI mejor respaldado por evidencia pública: TerraPay.**
**Proveedor para retiro de efectivo NI: NO DETERMINADO.**
**Nium: alternativa bancaria condicionada, no solución confirmada para cash pickup.**
Ninguna entidad ha concedido acceso, ofrecido contrato o aprobado Moneda Mundial.

### Estado de comunicaciones
Preparadas, no enviadas. El representante del proyecto debe revisar la información, decidir cuándo realizar contacto corporativo y completar contacto empresarial (sin compartir datos personales por GitHub).
