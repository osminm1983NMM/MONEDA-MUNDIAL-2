# Moneda Mundial 2.0 — etapa 135: bloqueo técnico de candidatos de publicación

**Estado: prototipo de revisión, no publicación ni transferencia real.**

## Revisión incorporada

La comprobación de solo lectura compara **dos APK reales**: la APK original
anterior y la posible actualización. No permite sustituir la APK original
por una fotografía de pantalla o un nombre de archivo sin verificar.

Bloquea si:

1. El paquete no es `com.monedamundial.app` o la versión no concuerda con `app.json`.
2. La candidata tiene firma `Android Debug`, como las APK actuales de laboratorio.
3. Falta la huella SHA-256 de distribución **aprobada externamente**, o no coincide.
4. La APK nueva fue firmada con otra clave que la versión anterior.
5. La nueva versión no aumenta estrictamente `versionCode`.

El comando, para cuando existan las dos APK y la huella pública aprobada,
es `node scripts/comprobar-candidato-actualizacion-publica.mjs APK_ANTERIOR.apk APK_NUEVA.apk`.
Requiere la variable `MWD_RELEASE_CERT_SHA256` proporcionada desde un entorno
de revisión seguro. **Nunca** colocar la clave privada de firma en variables
del código, documentos o conversaciones.

Incluso cuando el verificador devuelva `revisionesTecnicasSuperadas: true`,
mantiene **`autorizacionDePublicacion: false`** y
**`autorizacionDeDineroReal: false`**. La aprobación de licencias, protección
de datos, socios regulados, seguridad, distribución y titularidad de firmas
exige comprobaciones independientes.

## Estado actual

- Todavía no tenemos una clave definitiva de distribución custodiada.
- No se ha comprobado la APK que realmente tiene instalada el usuario.
- No se recomienda desinstalar la aplicación, pues se podrían perder datos.
- No hay cuentas bancarias ni transferencias reales activadas.

Referencias: [Android — actualizaciones](https://developer.android.com/google/play/app-updates)
y [Android — firma](https://developer.android.com/studio/publish/app-signing).
