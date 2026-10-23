# Moneda Mundial Coin — revisión segura de términos de compra (SOLO DEMO, 2026-10-23)

Este componente se basa en el simulador de ventas primarias de Coin desde tesorería ficticia. **No existe Coin emitida ni fondos reales, cuentas reales, stablecoin, blockchain, proveedor de precios o contrato de distribuidor**.

Antes de registrar una compra de prueba, se muestran precio ilustrativo, cantidad, comisión total, parte de la plataforma, parte del posible distribuidor y **total adicional que pagaría el comprador**. Un tope elegido en el formulario impide que se genere una confirmación con un total superior. La compra exige aceptación expresa de términos de prueba.

La misma `requestId` y cotización conserva una sola compra; dos solicitudes similares del mismo cliente dentro de diez minutos generan una advertencia. La repetición intencional exige aceptación separada. Si se pierde la respuesta, se conserva el estado incierto y solo se usa `recoverWithoutResubmitting`; nunca se asume que la falta de comprobante permite cobrar otra vez. Si la respuesta llega adulterada, no se declara compra verificada.

**No confundir ingresos:** el principal de USD 100 de venta de tesorería, y la comisión adicional hipotética de USD 1.50, son flujos distintos. Los USD 100 no son utilidad neta. El porcentaje que retenga un distribuidor no es automático ni genera pagos externos. El inventario de tesorería solo incluye monedas propias, no las que pertenezcan a compradores.

Requisitos antes de vender Coin: diseño y propiedad legal del token, revisión SEC/CFTC de características y **oferta**, análisis FinCEN/estados y países aplicables, AML/KYC/OFAC, licencia o socio aplicable, precios verificables, divulgación de spread/comisiones/impuestos, contabilidad conciliada, custodia, auditoría de contrato, mecanismos de reclamación y seguridad operativa. Para Moneda Mundial Digital: emisor autorizado y salvaguardas de reservas y redención independientes. Ningún documento auto-declarado habilita ventas.

Archivo principal: `src/digital-money/mock-coin-purchase-guard.mjs`.
Pruebas: `node --test tests/mock-coin-purchase-guard.test.mjs`.
**No desplegar ni conectar a dinero real, y no fusionar sin pruebas y revisión humana.**