# Moneda Mundial 2.0 — etapa 131: actualizaciones Android sin pérdida de datos

Estado: **control de compatibilidad DEMO**, no lanzamiento comercial.

## Problema que evitamos

Un nuevo APK con el mismo identificador `com.monedamundial.app` no se debe recomendar como actualización si fue firmado con otra clave. Una APK con un número de compilación anterior también debe bloquearse. En particular, las APK firmadas con claves `Android Debug` creadas temporalmente en diferentes compilaciones no deben suponerse compatibles entre sí.

## Verificación incorporada

El comando de solo lectura:

```bash
node scripts/comprobar-actualizacion-android.mjs APK_ANTERIOR.apk APK_NUEVA.apk
```

usa `apksigner verify --print-certs` y `aapt dump badging` del SDK Android. Rechaza, sin instalar ni borrar nada, si:

- el identificador de aplicación difiere de `com.monedamundial.app`;
- las huellas SHA-256 de los certificados son diferentes;
- `versionCode` no aumenta;
- falta algún informe verificable.

El informe `compatible: true` **solo** confirma esos requisitos técnicos; no autoriza dinero real, publicación, seguridad completa ni instalación sin otras pruebas.

## Requisitos pendientes antes de entregar una APK para Samsung

1. Completar el recorrido Android del mismo commit.
2. Conservar una clave de firma estable y protegida para versiones sucesivas. No colocar llaves privadas ni contraseñas en GitHub, JavaScript o este informe.
3. Definir explícitamente `android.versionCode` en `app.json` y aumentarlo en las compilaciones destinadas a actualización.
4. Comparar la nueva APK con la que realmente está instalada o con su APK original verificada.
5. Si la firma antigua no está disponible o no coincide, **detener la actualización** y decidir una migración de datos separada antes de considerar desinstalar.

Referencias: [Android — cómo funcionan las actualizaciones](https://developer.android.com/google/play/app-updates) y [Expo — configuración de versión](https://docs.expo.dev/versions/latest/config/app/#versioncode).
