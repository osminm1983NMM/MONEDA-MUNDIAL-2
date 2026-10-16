# Evaluación de proveedores US→Honduras preservando catálogo mundial
16 octubre 2026. Investigación de capacidad publicada, NO contrato ni aprobación.

## Política de países
El catálogo de diseño conserva **249 países** en Supabase (consulta verificada: HN=1, NI=1). Ningún país se retira. Honduras es únicamente corredor inicial de evaluación y ejemplo predeterminado. La selección de país en producto permanece global, pero disponibilidad de dinero real se habilitará **por origen-destino, moneda, método y socio contratado**; hasta entonces TODO queda bloqueado.
El mock de servidor ahora admite países de diseño inyectados y conserva US→HN como primera referencia, US→NI como referencia secundaria, sin pagos ni fondeo. Es importante que el catálogo completo se suministre explícitamente por el servidor; el mock por defecto sólo incluye ejemplos HN y NI.

## Evidencia de sitios oficiales: capacidad publicada NO equivale a integración autorizada
| Proveedor | Honduras | Nicaragua | Efectivo sin teléfono Honduras | Decisión |
| --- | --- | --- | --- | --- |
| **Thunes** | Su red global pública incluye **Honduras: Bank Accounts**, no Cash Pickups en esa ficha | **Nicaragua: Bank Accounts** | **NO CONFIRMADO**; la página sí incluye Cash Pickups en Jamaica y México, pero no aparece junto a Honduras | Candidato a integración bancaria y consulta específica de cash pickup, no afirmar que lo ofrece en HN |
| **TerraPay** | Su red muestra **Honduras: USD, Bank Payout**; no indica Cash Pickup | Muestra **Nicaragua: USD, Bank Payout** y había comunicado alianza Banpro para depósito | **NO CONFIRMADO** | Candidato fuerte a explorar depósito en cuenta en HN y NI, sujeto a elegibilidad US, condiciones y contrato |
| **Nium** | Catálogo Honduras publicado, opciones dependen de ruta y producto, no confirman cobro sin app | Catálogo Nicaragua con SWIFT y aclaración de cuenta corporativa | **NO CONFIRMADO** | Mantener como tercera alternativa y solicitar elegibilidad P2P |
| **MoneyGram/Ria** | Redes minoristas tradicionales de efectivo como línea de investigación adicional | Redes de remesas internacionales tradicionales | **NO CONFIRMADO para una API/contrato de Moneda Mundial** | Considerar contacto empresarial sólo tras confirmar programa de integración y corredor |

**Selección provisional:** contactar **TerraPay y Thunes** para depósito bancario US→HN; no existe proveedor acreditado para cumplir las 2 modalidades (depósito + cobro sin teléfono) en Honduras. El sistema puede necesitar dos socios distintos, bajo modelos regulatorios aprobados.

## Fuentes públicas originales
- Thunes direct global network: https://www.thunes.com/direct-global-network/ (Honduras Bank Accounts; Nicaragua Bank Accounts; Cash Pickups en otras rutas, NO HN).
- TerraPay network: https://www.terrapay.com/network/ (Honduras USD Bank Payout; Nicaragua USD Bank Payout).
- Nium Honduras: https://atlas.nium.com/country/honduras
- Nium Nicaragua: https://atlas.nium.com/country/nicaragua
- Thunes API: https://docs.thunes.com/money-transfer/v2/
- TerraPay contacto: https://www.terrapay.com/connect/

## Lo que debe confirmarse por escrito antes de dar cualquier capacidad como disponible
1. Corredor **EE.UU. como origen** → HN/NI como destino, envíos P2P de una fintech nueva, legislación de ambos extremos, cobertura bancaria local, divisas, costos y requisitos KYB.
2. ¿Agentes de **retiro de efectivo en Honduras y Nicaragua SIN móvil** del beneficiario? Identificación presencial, autenticación del agente, referencia de uso único, cancelación y prevención de doble pago.
3. Convenio, patrocinio legal, custodia, KYC/AML/OFAC, protección consumidor, reembolsos y reporte/conciliación.
4. Acceso a sandbox oficial y documentación vigente después de autorización de evaluación. No usar llaves de producción ni alterar saldos DEMO.
5. Futuras aperturas **país a país**, sin prometer todos los países operativos sólo por figurar en el selector.

**Estado comercial:** cero contratos, ninguna respuesta confirmada de proveedor, cero credenciales sandbox, sin fondos reales. No se han enviado solicitudes comerciales.
