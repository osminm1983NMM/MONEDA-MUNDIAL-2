# Moneda Mundial 2.0 — etapa 132: versión Android comprobable

Estado: **DEMOSTRACIÓN INTERNA**, sin pagos reales ni distribución al Samsung.

## Hallazgo comprobado el 24 de octubre de 2026

Dos compilaciones anteriores de CI (runs 40135662438 y 40136628747) contenían:

- Paquete: `com.monedamundial.app`.
- `versionCode`: **1**, en ambas.
- Certificado APK de demostración `CN=Android Debug` con igual huella SHA-256:
  `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.

Por ello, nuestro control conservador de etapa 131 **rechaza** usar la segunda como actualización de la primera: el código no aumentó. La coincidencia de una firma **debug** no la convierte en firma segura de distribución.

## Cambios de esta etapa

1. Fijamos `android.versionCode: 2` en `app.json` para **la próxima APK interna de este branch**. Se mantiene la versión visible `2.0.0` y el paquete.
2. Una comprobación automática compara el paquete y `versionCode` del APK compilado (`aapt dump badging`) con la configuración fuente. Bloquea informes faltantes o discrepantes.
3. GitHub Actions ejecuta pruebas unitarias de estos controles y, tras compilar, verifica en la APK real los metadatos antes de probar el recorrido invitado en emulador.

## Lo que todavía NO autoriza

- No implica que la APK sea actualizable sobre la versión del **Samsung del usuario**, que todavía no se comparó.
- No indica que la firma debug sea apta para una distribución comercial.
- No autoriza transferencias reales, fondos, emisión de Moneda Mundial Digital ni venta de Coin.
- No requiere desinstalar, exportar credenciales ni introducir información sensible.

Para distribuir futuras versiones habrá que elegir y custodiar una **clave de firma de distribución estable**, establecer el método de respaldo y comprobar explícitamente la firma de la versión instalada antes de cualquier paso irreversible.

Referencias primarias: [Android: requisitos de actualización](https://developer.android.com/google/play/app-updates) y [Expo: versiones de aplicación](https://docs.expo.dev/build-reference/app-versions/).
