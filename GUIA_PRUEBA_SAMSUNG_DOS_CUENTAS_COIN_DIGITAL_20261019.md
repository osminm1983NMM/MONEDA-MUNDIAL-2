# Moneda Mundial 2.0 — prueba manual Samsung, dos cuentas y Coin ↔ Digital
**Fecha de preparación:** 19 de octubre de 2026 · **SOLO DEMOSTRACIÓN**

Esta guía está pensada para comprobar la app **desde un solo teléfono Samsung**. No constituye una certificación financiera, de seguridad o de producción. Ninguna moneda Coin o Digital se ha emitido ni representa fondos retirables.

## Antes de instalar
- **No instalar una APK nueva hasta confirmar** que GitHub Actions completó tanto la compilación como el arranque en emulador y creó el artefacto `moneda-mundial-demo-apk-arranque-verificado` del **mismo commit**. Los resultados anteriores no certifican un commit nuevo.
- Flujo de esta versión: https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/39301885956 (al redactar esta guía seguía en ejecución). Consultar el estado final antes de cualquier instalación.
- La APK de GitHub es una **build con firma temporal de pruebas**, nunca para usar con fondos, claves bancarias, identidades reales o credenciales financieras. No compartir APK por mensajería.
- Si ya está instalada otra versión, **no desinstalarla** cuando haya un registro de conversión pendiente: la desinstalación puede borrar datos locales necesarios para conciliación. Las firmas temporales de versiones distintas pueden impedir la actualización. No anular protecciones Android.
- Crear/utilizar exclusivamente **dos cuentas autorizadas de ensayo** (A y B), sin datos bancarios ni personales innecesarios.

## Pruebas de un único teléfono (sin operaciones reales)

1. **Instalación y procedencia:** desde GitHub, abrir el flujo correcto terminado con `success` y su sección **Artifacts**; descargar `moneda-mundial-demo-apk-arranque-verificado`. En **Mis archivos > Descargas**, extraer ZIP e instalar únicamente `app-release.apk` si las advertencias y políticas del dispositivo lo permiten. Registrar el ID del flujo y el commit.
2. **Pantalla inicial:** verificar que diga **Moneda Mundial DEMO / SOLO DEMOSTRACIÓN** y que no solicite depósito, tarjeta ni retiro real.
3. **Cuenta A:** entrar con la primera cuenta de prueba; comprobar saldos **MWD, COIN y Digital/STABLE separados**; anotar únicamente cantidades DEMO, nunca contraseñas.
4. **Coin → Digital (A):** cotizar una cantidad ficticia permitida, leer importe, tarifa y vencimiento; confirmar **una sola vez** y verificar recibo, historial y saldos separados. Si la pantalla informa resultado incierto, **no volver a pagar/confirmar**; consultar con la misma referencia de ensayo.
5. **Cerrar sesión A y entrar B:** comprobar que el historial de A **no** aparece en B. Las cuentas pueden empezar con saldos idénticos; el control es el historial y las diferencias después de la operación A. Si se mezclan, suspender la prueba y reportar.
6. **Digital → Coin (B):** repetir la cotización/confirmación simulada en dirección inversa y verificar recibo. Cerrar sesión de B, volver a A y confirmar que la actividad de B no alteró A.
7. **Error de red:** con **cotización nueva sin confirmar**, apagar internet, comprobar mensaje de error y verificar que no indique éxito. No manipular la red durante una confirmación ya iniciada si el teléfono puede perder un registro local; si sucede, usar la opción de **consultar estado sin repetir operación**.
8. **Reinicio y retorno:** cerrar y abrir la aplicación, comprobar que conserva correctamente el estado de conversiones pendientes y que nunca muestra un saldo estimado mientras carga datos.
9. **Registrar evidencia mínima:** resultado por paso (aprobado/falló/no probado), versión/commit, fecha y texto del error sin incluir emails, tokens, números de cuenta, QR, contraseñas ni códigos de retiro.

## Criterios para detener las pruebas
- Saldo o historial de otra cuenta visible.
- Un reintento crea una segunda conversión para la misma cotización.
- Se muestra éxito ante una solicitud incierta no conciliada.
- Falta el aviso SOLO DEMOSTRACIÓN o se solicita dinero real.
- La app muestra errores de seguridad o Android impide instalar con seguridad.

## Lo que aún NO demuestra esta guía
No prueba regulación, reservas, cumplimiento KYC/AML, permisos con JWT firmado desde API, seguridad completa, concurrencia bancaria, funcionamiento financiero de una stablecoin, emisión de COIN, ni que el producto pueda operar con dinero real. Los resultados de una APK en emulador tampoco sustituyen la prueba en un Samsung físico.
