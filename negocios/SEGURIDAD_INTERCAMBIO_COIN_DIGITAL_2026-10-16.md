# Moneda Mundial — seguridad del intercambio Coin ⇄ Digital
**Fecha:** 16 de octubre de 2026. **Estado:** simulador aislado, no mercado financiero real.

## Avance técnico
Se ha creado `src/digital-money/mock-coin-digital-settlement.mjs`, un modelo de ejecución estrictamente **en memoria y sólo modo mock**. No se importa dentro de Android, no se conecta a Supabase, bancos, blockchain, cotizaciones o proveedores y NO emite tokens ni representa fondos.

- Dos activos hipotéticos: Coin (variable) y Digital (concepto estable).
- Dos cuentas inventadas: `demo_user` y `demo_pool`. No representan compradores, clientes o reservas efectivas.
- Una cotización manual de prueba expira a los 120 segundos. El sistema verifica la disponibilidad de unidades ficticias del usuario y de un fondo ficticio y **reserva** unidades durante 60 segundos como máximo.
- Una finalización de prueba desplaza unidades enteras entre las dos cuentas en la misma llamada sin incrementar la suma total de ninguno de los activos. La cancelación y el vencimiento liberan reservas.
- Los identificadores de reintento evitan crear dos reservas o dos finalizaciones con una misma solicitud. Los cambios quedan en un historial sin secretos ni datos personales.
- No existe operación de compraventa, valoración de mercado, empresa emisora, precio, liquidez real, claves, firma, respaldo ni liquidación bancaria.

## Limitaciones que deben resolverse para fondos reales
Este prototipo **no es un libro mayor bancario**. No es durable ni distribuido: al reiniciar desaparece, y no maneja concurrencia entre servidores, bloqueos SQL, conciliación, reversos, insolvencias, colateral o insolvencia de contraparte. No debe conectarse directamente a un producto real. Para los pagos con dinero verdadero debemos diseñar un backend con ledger de partida doble duradero, idempotencia persistente, transacciones ACID y conciliación de cada proveedor y la blockchain.

**Próxima etapa:**
1. Estudiar un proveedor con liquidez Coin/Digital verificable y una stablecoin de emisor autorizado, una vez existan los activos y las aprobaciones requeridas.
2. Formalizar modelo de custodia de billeteras y autenticación de usuarios.
3. Definir límites regulatorios por corredor y monitoreo contra fraude.
4. Probar reconciliación y pruebas de carga en un entorno desconectado.
5. Mantener prioridades paralelas: constituir empresa, socio de remesas US→HN, cumplimiento y plataforma bancaria real. Nicaragua y catálogo mundial permanecen disponibles a nivel de diseño.

**Prohibido:** utilizar este mock para captación de fondos, oferta de monedas, intercambio en producción o vinculación con saldos MWD ficticios.
