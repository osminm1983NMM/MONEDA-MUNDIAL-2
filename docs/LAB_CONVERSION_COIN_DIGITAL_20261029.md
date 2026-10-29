# Laboratorio Coin ↔ Digital — 29 de octubre de 2026

**Alcance:** fichas educativas locales, no criptomonedas, dinero, stablecoin, remesa, operación financiera ni saldo MWD de Supabase.

## Qué se agregó

- Botón **«Laboratorio Coin ↔ Digital · fichas ficticias»** en Servicios, visible al iniciar sesión.
- 100 fichas Coin y 100 fichas Digital iniciales **por usuario de prueba y dispositivo**.
- Conversión bidireccional según precios manuales ilustrativos (Coin 0.25 USD y Digital 1 USD como ejemplo, **no** cotizaciones).
- Un registro de saldo e historial en AsyncStorage por `auth.user.id`, separado de los saldos y movimientos MWD del servidor.
- Confirmación antes de guardar, bloqueo de dobles pulsaciones, clave de operación idempotente y rechazo de saldos insuficientes.
- Rechazo de datos locales corruptos sin reiniciarlos automáticamente; si falla el guardado no se informa éxito.

## Prueba manual en Samsung

1. Iniciar sesión con cuenta A y abrir el nuevo laboratorio. Coin = 100, Digital = 100.
2. Con Coin → Digital, cantidad 10 y precios ficticios 0.25 / 1, comprobar resultado previo 2.5 Digital.
3. Confirmar el registro; Coin debe quedar en **90**, Digital en **102.5**, con una línea nueva en el historial local.
4. Cambiar a Digital → Coin con cantidad 2.5 y los mismos precios; confirmar. Ambas cantidades deben volver a **100**.
5. Cerrar sesión y entrar con la cuenta B. Debe empezar con **100/100** y sin movimientos del usuario A.
6. Volver a A; la prueba y el historial deberían conservarse en el mismo Samsung. Los MWD de las billeteras A y B **no deben cambiar**.

## Límites y requisitos pendientes

- Los datos **no se sincronizan** con Supabase, otros dispositivos ni instalaciones que borren almacenamiento; no son saldos financieros ni tokens emitidos.
- La demostración no reserva liquidez ni aplica comisiones, spreads o costos de red. Nunca puede comprar, vender, retirar, pagar ni enviar activos reales.
- Antes de habilitar un saldo compartido entre dispositivos se necesita un backend de pruebas independiente, diseño de libro mayor transaccional y controles de autorización y concurrencia; eso **no** se agrega en esta etapa.
- No se cambian tablas, funciones o políticas de Supabase; las transferencias MWD existentes permanecen aisladas.
- La compilación de Android debe hacerse desde la nueva rama después de revisar la propuesta; la APK probada previamente no contiene este laboratorio.

## Comprobaciones automáticas

- `node --test tests/coin-digital-local-lab.test.mjs`
- `EXPO_NO_TELEMETRY=1 npm test`
- `EXPO_NO_TELEMETRY=1 npx expo export --platform android`

La identidad de la variante Samsung LAB y la versión de la APK se deben verificar antes de instalar una compilación nueva; no se publica una aplicación financiera.
