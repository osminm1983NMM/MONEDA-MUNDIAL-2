# Moneda Mundial 2.0 — búsqueda inicial de proveedores financieros regulados
**Fecha de consulta pública:** 17 de octubre de 2026  
**Objetivo:** evaluar la ruta EE. UU. → Honduras como primera candidata, sin excluir Nicaragua ni ningún otro país del catálogo mundial.  
**Situación:** INVESTIGACIÓN Y CONTACTO PENDIENTE; no es un acuerdo, licencia, integración, aprobación, sandbox oficial ni permiso de mover fondos.

## Lectura de evidencias y límites
Separar tres cosas distintas:
- **Capacidad publicada:** una página informativa del proveedor describe una red o modalidad.
- **Corredor confirmado:** su equipo comercial/compliance confirma por escrito que Moneda Mundial, como entidad y caso de uso concreto, puede operar desde Estados Unidos al destino y método seleccionado, dentro de las jurisdicciones y requisitos aplicables.
- **Servicio autorizado en producción:** además de la confirmación anterior, existen contratos, aprobación jurídica independiente, licencias/cobertura confirmadas, documentación oficial, ensayos sandbox, controles AML/KYC, fondos segregados y autorización formal por corredor.

NINGUNA capacidad publicada equivale a las otras dos. Todos los estados operativos de Moneda Mundial siguen desactivados.

## 1. Nium — candidato a transferencias bancarias/tarjetas
**Fuentes oficiales consultadas:**
- Catálogo Honduras: https://info.nium.com/country/honduras
- Catálogo regional: https://atlas.nium.com/?region=North+America
- APIs/sandbox: https://www.nium.com/developers

**Qué consta públicamente:** el catálogo de Honduras muestra *foreign currency wire transfer* y *Visa Direct (HNL)*. El catálogo regional también muestra Nicaragua mediante *foreign currency wire transfer*. La página de desarrollo anuncia APIs y entorno sandbox.  
**NO confirmado:** aceptación de nuestra empresa, recepción/fondeo desde EE. UU. para el caso C2C, cobertura de estados en EE. UU., Visa Direct en la tarjeta concreta, costo/FX, agentes de retiro de efectivo sin teléfono, acceso sandbox concedido, convenio o cobertura legal. No inferir retiro en efectivo del listado publicado.  
**Prioridad:** preguntar por cuentas y tarjetas, y específicamente si tienen red de cash pickup asociada o no.

## 2. TerraPay — candidato a abono bancario y validación del beneficiario
**Fuentes oficiales consultadas:**
- Red publicada: https://www.terrapay.com/network/
- Producto de validación: https://www.terrapay.com/verify/
- Contacto corporativo: https://www.terrapay.com/connect/

**Qué consta públicamente:** el catálogo de red muestra Honduras en USD con abono bancario publicado y Nicaragua en USD con abono bancario publicado. TerraPay Verify describe comprobaciones de cuentas/beneficiarios como servicio, pero hay que confirmar cobertura exacta de Honduras y el método.  
**NO confirmado:** modalidad HNL, origen regulado desde EE. UU., si permite empresa en formación o necesita entidad constituida, verificación concreta de identidad presencial, cash pickup sin teléfono, disponibilidad de su producto Verify para el corredor, precio, contrato o credenciales.  
**Prioridad:** abono bancario y verificación; preguntar por retirada en efectivo y relación con agentes autorizados.

## 3. Thunes — candidato para preguntar por retirada en efectivo
**Fuentes oficiales consultadas:**
- Documentación Money Transfer v2: https://docs.thunes.com/money-transfer/v2/
- Contacto B2B: https://www.thunes.com/contact/
- Programa de socios: https://www.thunes.com/thunes-partner-programme/

**Qué consta públicamente:** la documentación técnica general describe modalidades de transferencia, incluyendo cuentas, tarjetas, billeteras móviles y *Cash Pickup*, con mecanismos de estado de pago.  
**NO confirmado:** que cash pickup esté disponible US→HN; que admitan un destinatario sin teléfono o sin cuenta; sucursales, agente pagador y método de verificación de identidad; cobertura legal desde EE. UU.; onboarding de nuestra empresa; precio, sandbox, contrato o licencia. No tomar ejemplos de otros países como evidencia de Honduras.  
**Prioridad:** preguntar por cash pickup presencial y la forma de verificar beneficiarios sin aplicación ni teléfono.

## Preguntas obligatorias, iguales para cada candidato
1. Nombre y jurisdicción exactos de la entidad que contrata con nosotros; registros/licencias aplicables; modelo de patrocinio (si existe) y alcance por estados de EE. UU.
2. Disponibilidad comercial y regulatoria para **C2C US (USD) → HN** separando **cuenta bancaria, tarjeta y retiro de efectivo**, monedas finales admitidas y canal de financiamiento.
3. ¿Se puede verificar presencialmente a un beneficiario **sin móvil y sin cuenta en Moneda Mundial**? ¿Quién lo hace? ¿Qué documentos admite? ¿Quién controla el código de cobro único?
4. Catálogo escrito por corredor para Nicaragua (NI), Ecuador (EC), Costa Rica (CR), El Salvador (SV) y otros mercados, **sin activar ningún destino por aparecer en un catálogo**.
5. KYC/KYB/AML/OFAC: responsabilidades de ambas partes y obligaciones de monitoreo/notificación.
6. Sistema legal de custodia/salvaguarda de fondos del cliente; quién recibe USD y quién ejecuta desembolso o reembolso.
7. API y sandbox oficiales, tipos de evento, firma de webhooks, expiración y anti-replay, idempotencia y reconciliación (sin inventar endpoints ni pedir secretos por email).
8. Tarifas por operación, comisiones del usuario, tipo de cambio y margen, reversos, devoluciones, disputas y plazos.
9. Requisitos de incorporación: ¿aceptan un proyecto pre-LLC para conversación inicial? ¿Qué documentación se debe presentar para habilitar un sandbox?
10. Confirmación escrita del **método concreto** y de la entidad autorizada, no solo cobertura genérica del país.

## Tabla de decisión — NO habilita proveedores
| Candidato | Caso de uso que merece estudio | Presencia pública relevante | US→HN con nuestro modelo | Cash pickup HN confirmado | Contrato | Sandbox oficial para MWD | Operación real |
|---|---|---|---|---|---|---|---|
| Nium | Banco/tarjeta | Sí, catálogo de HN | No confirmado | No confirmado | No | No | NO |
| TerraPay | Banco/verificación | Sí, catálogo HN/USD | No confirmado | No confirmado | No | No | NO |
| Thunes | Estudiar cash pickup | Sí, producto general | No confirmado | No confirmado | No | No | NO |

**No almacenar credenciales, documentos de identidad ni cuentas personales en el repositorio.** El módulo `src/server/provider-corridor-diligence.mjs` requiere evidencia vinculada al proveedor/corredor y sigue bloqueando operaciones reales incluso con expediente aparentemente completo.

## Mensaje empresarial modelo (ENGLISH — preparar envío, NO enviado)
**Subject:** Moneda Mundial 2.0 — US-to-Honduras regulated remittance API and payout capabilities

Hello Business Development / Partnerships Team,

We are developing Moneda Mundial 2.0, a cross-border wallet and remittance application currently running in a non-monetary demonstration environment. We are evaluating licensed or appropriately regulated infrastructure partners for a potential **United States (USD) → Honduras** launch, while planning future coverage country by country.

Could you confirm whether your organization can support our proposed consumer remittance model and specify:
- Legal entities, licensing/sponsorship model and applicable U.S. state scope for originating the transfer.
- The Honduras corridor by payout method: bank account, eligible card and **in-person cash pickup without the beneficiary needing our app or a smartphone**.
- Sender funding options, payer/beneficiary KYC responsibilities, AML/sanctions controls, consumer disclosures and refund/error workflows.
- Beneficiary identity verification, payout reference protection, single-use redemption, settlement confirmation and reconciliation.
- Onboarding requirements, written corridor availability, API documentation, **official sandbox access** and indicative commercial pricing.
- Preliminary expectations for a project that has not yet incorporated a company.

We are not asking to move customer funds or access production credentials at this stage. We would appreciate a written explanation of eligibility and the process for a compliance-led technical evaluation.

Thank you,  
Moneda Mundial 2.0 — Project Team

## Próximo hito verificable
Recibir por escrito una respuesta de al menos un proveedor. Registrar fecha, entidad emisora, alcance legal y modalidades, y consultar asesoría regulatoria antes de contratar. Hasta entonces:
- **Candidatos evaluados públicamente:** 3.
- **Proveedores contratados:** 0.
- **Proveedores conectados a producción:** 0.
- **Corredores con dinero real habilitado:** 0.
- **Dinero real enviado:** 0.
