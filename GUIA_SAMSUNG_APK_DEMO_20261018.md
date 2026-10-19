# Moneda Mundial 2.0 — instalar APK de demostración en Samsung (19 oct 2026)

> **SOLO DEMOSTRACIÓN.** Sin transferencias de dinero real, sin activos digitales emitidos y sin proveedores bancarios integrados. Nunca uses credenciales bancarias ni deposites dinero.

## APK verificada en Android

- Código verificado (commit): `6b3b76d971044342db7c28a04c6fe5c078cb1338`
- Flujo GitHub Actions: https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/39261651967
- Artefacto: **moneda-mundial-demo-apk-arranque-verificado**
- Generada con firma temporal **de prueba**, no una firma oficial de lanzamiento.
- Artefacto validado expira aproximadamente el **26 de octubre de 2026** (UTC); GitHub Actions conserva los archivos temporalmente.

## Descargar desde un solo teléfono Android (Samsung)

1. Abre el enlace del flujo de GitHub Actions anterior e inicia sesión en **tu propia cuenta GitHub** si te lo solicita.
2. Abre **Artifacts** del flujo completado y selecciona `moneda-mundial-demo-apk-arranque-verificado`. GitHub descarga un **ZIP**, no instala automáticamente la aplicación.
3. Abre **Mis archivos** de Samsung → **Descargas** → ZIP descargado. Pulsa **Extraer**.
4. En los archivos extraídos busca `app-release.apk`. Comprueba que procede de *este* flujo y no de un enlace reenviado por terceros.
5. Toca la APK para instalarla solo si Android y tus ajustes de seguridad lo permiten. No desactives protecciones del teléfono ni omitas alertas de seguridad para forzar la instalación.
6. Abre Moneda Mundial y verifica que aparezca el aviso **SOLO DEMOSTRACIÓN**. Utiliza únicamente cuentas y datos ficticios autorizados para pruebas.

## Confirmar la versión correcta

Usa exclusivamente el artefacto `moneda-mundial-demo-apk-arranque-verificado` del flujo **39261651967**. El commit de esta APK es `6b3b76d971044342db7c28a04c6fe5c078cb1338`.

El archivo se descarga como ZIP desde GitHub y **no** es una app disponible en Play Store. La verificación automática de APK del flujo terminó en `success`. No instales versiones que lleguen por WhatsApp o enlaces desconocidos.

## Si ya tenías instalada otra versión

La firma es de prueba y puede ser distinta entre compilaciones. Si Android indica que no es posible actualizar, **no desinstales precipitadamente**: la desinstalación puede borrar los datos locales, incluidos registros de confirmaciones inciertas. Primero verifica que no haya operaciones DEMO pendientes de reconciliar y conserva los datos necesarios para la prueba. No intentes forzar la instalación ni instalar sobre una versión de procedencia incierta.

## Alcance de lo que GitHub comprobó

- Compiló una APK de prueba desde el mismo commit.
- La instaló e inició en un emulador Android.
- Detectó la marca de la aplicación, el aviso **SOLO DEMOSTRACIÓN** y la pantalla de acceso.
- Comparó la huella SHA-256 de la APK usada en el test.

**No se ha verificado aún en un Samsung físico con dos cuentas de prueba.** La compilación de 19 de octubre sí superó el arranque en emulador, pero esa prueba no sustituye la revisión en el teléfono. El flujo automático de arranque no comprueba pagos, saldos autenticados ni conversiones Coin ↔ Digital; tampoco habilita transferencias reales.

## Prueba manual recomendada después de instalar

Con dos cuentas de prueba autorizadas y sin datos bancarios: comprobar inicio y cierre de sesión; saldos separados MWD/COIN/STABLE; cotización ficticia; confirmación; recibo e historial; desconexión de internet; retorno al conversor; conciliación por referencia; y separación de datos entre cuentas. Reportar las capturas sin información privada ni contraseñas.

**No usar esta APK para operaciones financieras ni distribuirla como versión comercial.**
