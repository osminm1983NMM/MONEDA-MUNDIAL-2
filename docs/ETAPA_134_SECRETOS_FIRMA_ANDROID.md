# Moneda Mundial 2.0 — etapa 134: proteger secretos de firma

Esta etapa añade una protección previa a manejar cualquier clave de distribución.

- `.gitignore` dificulta agregar accidentalmente keystores, claves y `.env`.
- Un control de solo lectura revisa nombres de archivos versionados y marcadores
  de claves privadas en código/documentación. Fallará si se encuentra material
  de riesgo y no imprime el contenido sensible.
- Una prueba rápida en GitHub aplica el control. La compilación Android de la
  rama también se detiene antes de instalar dependencias si detecta secretos.

**Limitaciones importantes:** este control cubre patrones habituales, no todas
las formas de credenciales o fugas. Además, una revisión que se ejecuta tras
el push no deshace una divulgación previa. Mantener todas las claves privadas
fuera del repositorio y configurar protección de secretos independiente sigue
siendo obligatorio.

No hemos creado ni cargado una clave de firma de distribución. Las APK actuales
siguen siendo únicamente DEMO con certificado Android Debug. No se han tocado
datos del Samsung, cuentas de usuario, Supabase, dinero ni token alguno.

Referencia: [Android App Signing — protege las claves](https://developer.android.com/studio/publish/app-signing).
