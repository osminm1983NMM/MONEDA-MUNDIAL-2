# Moneda Mundial 2.0 — estrategia comercial de comisiones (borrador)

**Decisión del fundador (14-10-2026):** descarga y registro **gratuitos**; preferencia por comisiones competitivas, **inferiores a las de proveedores comparables cuando la economía real lo permita**, pero suficientes para que el negocio sea rentable y sostenible.

## Estado
- **Solo planeación.** La app actual opera con MWD ficticios, sin fondos reales, comisiones reales ni ingresos.
- **No existe tarifa pública aprobada.** No activar cobros, retiros ni procesamiento real sin alianzas, revisión jurídica y autorización aplicable.
- No afirmar que Moneda Mundial es más barata que *toda* la competencia: hay rutas y métodos más económicos según el caso.

## Hipótesis que deben validarse con proveedores y costos

| Servicio | Principio | Criterio antes de publicarlo |
|---|---|---|
| Descargar, registrarse y consultar saldo | Gratis | Confirmar costo de adquisición y soporte |
| Transferencias entre billeteras de prueba | Gratis | En el futuro dependerá de regulación, fuente de fondos y red de liquidación |
| Transferencia internacional real | Comisión transparente y competitiva; puede ser % + mínimo justificado | Comparar por país, moneda, método, tipo de cambio y dinero final recibido |
| Pago comercial fondeado por banco o saldo regulado | Precio inferior al de competidores comparables si hay margen | Incluir pasarela, fallos, fraude, contracargos, soporte, bancos e impuestos |
| Pago comercial con tarjeta | No prometer 2% ni menos sin precio de adquisición más bajo | Las tarifas estándar de procesamiento de tarjeta pueden superar la comisión que queremos cobrar |
| Aportaciones | Sin comisiones ocultas; identificar finalidad y receptor | Diseñar contabilidad, destinatario, obligaciones legales y condiciones específicas |

## Unidad económica obligatoria
**Ingreso bruto por operación** = comisión explícita + otros ingresos *permitidos, divulgados y realmente obtenidos*.

**Margen de contribución** = ingreso bruto - costos variables de red/proveedor - fraude y devoluciones esperadas - conversión FX - costos variables de soporte/cumplimiento - impuestos transaccionales aplicables.

**Beneficio neto** = suma de márgenes de contribución - costos fijos (equipo, licencias, tecnología, contabilidad, auditorías, seguros, impuestos empresariales, etc.).

### Ejemplo ilustrativo; no precio final
Una operación de $100 con tarifa del 1% produce $1 bruto. Si el costo total variable es $0.65, quedan $0.35 de margen de contribución, **no** $1 de utilidad neta. Si el costo total es $1.20, la operación pierde $0.20 y no debe ofrecerse a esa tarifa.

## Regla de tarifas responsable
1. Elegir **una jurisdicción y una ruta de pagos** para el piloto, no todos los países de una vez.
2. Solicitar propuestas de proveedores autorizados y calcular costos totales efectivos.
3. Medir 3–5 competidores de la **misma ruta, importe y método de pago**, incluyendo margen de tipo de cambio y lo que realmente recibe el beneficiario.
4. Elegir comisión inferior a alternativa comparable **solo si** cubre costos y deja margen adecuado; si no, renegociar o posponer ese servicio.
5. Mostrar antes de confirmar: importe, comisión, moneda, tipo de cambio si aplica, impuestos aplicables, total a pagar y dinero a recibir.
6. Establecer límites, comisiones mínimas o máximas solo si se justifican y se anuncian de forma transparente.
7. Llevar contabilidad separada: fondos de clientes **no** son ingresos de la empresa.

## Referencias de mercado consultadas el 14-10-2026 (sujetas a cambios)
- Wise: la comisión depende de ruta, monto, financiación y divisa; anuncia tarifas desde 0.23% en su página estadounidense: https://wise.com/us/pricing/
- Stripe US: tarjetas nacionales online estándar, 2.9% + $0.30 por transacción; ver https://stripe.com/pricing
- Stripe US ACH Direct Debit, tarifa estándar anunciada 0.8% con tope de $5, sujeto a condiciones y producto; misma fuente.

## Próximas acciones, aún pendientes
- Obtener cotizaciones vinculantes de al menos dos socios bancarios o procesadores y asesoría legal para la jurisdicción inicial.
- Diseñar tabla parametrizada y auditable de tarifas por país, método y moneda, siempre en servidor; nunca permitir que el teléfono decida el importe final de una transacción.
- Simular comisiones en MWD ficticios, sin confundir créditos con dinero real.
- Preparar cuadro de mando del propietario: volumen procesado, comisiones brutas, costos, pérdidas por fraude, devoluciones, margen y utilidad; acceso restringido.
- Aprobar las tarifas finales por escrito antes de publicar ofertas comerciales.

**Este documento define la orientación comercial; no constituye oferta de servicios financieros ni habilita movimientos de dinero real.**
