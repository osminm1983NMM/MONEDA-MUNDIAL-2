# Moneda Mundial Coin ⇄ Digital — recuperación de conversiones de laboratorio (23 octubre 2026)

## Objetivo implementado
El motor ficticio `mock-coin-digital-settlement.mjs` conserva órdenes, reservas y cotizaciones en memoria. Agregamos una **consulta por requestId** (`getDemoReservationByRequest`) para que, tras una respuesta perdida, una capa orquestadora pueda comprobar el estado de la reserva **sin crear otra**.

Ejemplo: el usuario de DEMO tiene 100 Coin inventadas; reserva 10 Coin para un resultado hipotético de 25 Digital de prueba. Si se pierde la respuesta, la consulta devuelve el identificador de esa misma reserva; una segunda reserva no es necesaria. La simulación verifica conservación de activos y bloqueo de saldo doble. Si la reserva venció, sólo informa su estado: no renueva ni autoriza liquidación tardía.

## Límites y seguridad
- Sólo DEMO en memoria. No hay stablecoin emitida, precio oficial, paridad al USD, blockchain, reservas bancarias ni conversión real.
- El requestId identifica una intención; **no** es autenticación del cliente. No exponer este módulo como API pública. Una implementación real necesitará cuentas autenticadas, autorización, transacciones atómicas de base de datos y registro durable de eventos.
- Las cotizaciones actuales son números manuales sin proveedor, deslizamiento de mercado, comisiones certificadas ni disponibilidad de contraparte. Una conversión real debe mostrar todas las tarifas, caducidad, cambio, liquidez y cantidad mínima a recibir.
- Antes de producción: asesoría legal por oferta e intermediación de criptoactivos, registro/licencias de transmisor/intercambiador cuando correspondan, KYC/AML y sanciones, emisor y reservas legales de Digital, custodia, auditoría de contratos, prueba de reservas, controles de ciberseguridad y manejo de disputas.
- **No activar dinero real, ventas, retiros ni stablecoin**. No fusionar hasta revisión y comprobación de CI.

Pruebas: `node --test tests/mock-coin-digital-recovery.test.mjs`; flujo original en `tests/mock-coin-digital-settlement.test.mjs`.
