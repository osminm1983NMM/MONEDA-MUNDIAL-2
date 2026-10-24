# Moneda Mundial 2.0 — etapa 133: identidad y procedencia de la APK

**Uso exclusivo de laboratorio.** No constituye autorización para publicar,
instalar sobre el Samsung, operar fondos o distribuir Moneda Mundial Coin.

## Control incorporado

En el mismo flujo de GitHub que compila la APK se genera un registro JSON con:

1. SHA-256 de todos los bytes del archivo APK (`sha256Apk`).
2. Paquete y `versionCode` extraídos con `aapt` y comparados con `app.json`.
3. Huella SHA-256 de la firma verificada por `apksigner`.
4. Commit exacto y número de ejecución de GitHub Actions.
5. Señales explícitas `autorizaDistribucion: false` y `autorizaDineroReal: false`.

El archivo se adjunta con las evidencias del emulador. La comprobación **falla
cerrada** si falta cualquiera de esos datos, si cambia el paquete o el número
de compilación, o si la firma no corresponde al modo de demostración.

Este manifiesto no es una firma criptográfica independiente y no reemplaza una
cadena de suministros auditada, una llave de distribución custodiada, la
verificación del APK instalado por el usuario ni las pruebas de saldos y
operaciones con dos cuentas. En esta fase solo documenta la procedencia de la
APK construida y probada por el mismo flujo de laboratorio.

Para distribución real: mantener una clave de firma protegida y estable,
aprobar separadamente su huella pública y la versión, y comparar con la app
existente antes de actualizar. **Nunca** almacenar llaves privadas ni
contraseñas en archivos del proyecto o conversaciones.

Referencias: [Android App Signing](https://developer.android.com/studio/publish/app-signing) y [apksigner](https://developer.android.com/tools/apksigner).
