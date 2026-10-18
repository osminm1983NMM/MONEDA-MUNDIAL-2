# Moneda Mundial 2.0 — instalar APK de demostración en Samsung (18 oct 2026)

> **SOLO DEMOSTRACIÓN.** Sin transferencias de dinero real, sin activos digitales emitidos y sin proveedores bancarios integrados. Nunca uses credenciales bancarias ni deposites dinero.

## APK verificada en Android

- Código verificado (commit): `68349ebfe39d6b5cfdfae1ef7b742101f00daf27`
- Flujo GitHub Actions: https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/39173592224
- Artefacto: **moneda-mundial-demo-apk-arranque-verificado**
- Generada con firma temporal **de prueba**, no una firma oficial de lanzamiento.
- Artefacto expira el **25 de octubre de 2026**; los archivos de GitHub Actions se conservan solo temporalmente.

## Descargar desde un solo teléfono Android

1. Abre el enlace del flujo de GitHub Actions anterior e inicia sesión en **tu propia cuenta GitHub** si te lo solicita.
2. Abre **Artifacts** del flujo completado y selecciona `moneda-mundial-demo-apk-arranque-verificado`. GitHub descarga un **ZIP**, no instala automáticamente la aplicación.
3. Abre **Mis archivos** de Samsung → **Descargas** → ZIP descargado. Pulsa **Extraer**.
4. En los archivos extraídos busca `app-release.apk`. Comprueba que procede de *este* flujo y no de un enlace reenviado por terceros.
5. Toca la APK para instalarla solo si Android y tus ajustes de seguridad lo permiten. No desactives protecciones del teléfono ni omitas alertas de seguridad para forzar la instalación.
6. Abre Moneda Mundial y verifica que aparezca el aviso **SOLO DEMOSTRACIÓN**. Utiliza únicamente cuentas y datos ficticios autorizados para pruebas.

## Si ya tenías instalada otra versión

La firma es de prueba y puede ser distinta entre compilaciones. Si Android indica que no es posible actualizar, **no desinstales precipitadamente**: la desinstalación puede borrar los datos locales, incluidos registros de confirmaciones inciertas. Primero verifica que no haya operaciones DEMO pendientes de reconciliar y conserva los datos necesarios para la prueba. No intentes forzar la instalación ni instalar sobre una versión de procedencia incierta.

## Alcance de lo que GitHub comprobó

- Compiló una APK de prueba desde el mismo commit.
- La instaló e inició en un emulador Android.
- Detectó la marca de la aplicación, el aviso **SOLO DEMOSTRACIÓN** y la pantalla de acceso.
- Comparó la huella SHA-256 de la APK usada en el test.

**No se ha verificado aún en un Samsung físico con dos cuentas de prueba.** El flujo automático de arranque no comprueba pagos, saldos autenticados ni conversiones Coin ↔ Digital; tampoco habilita transferencias reales.

## Prueba manual recomendada después de instalar

Con dos cuentas de prueba autorizadas y sin datos bancarios: comprobar inicio y cierre de sesión; saldos separados MWD/COIN/STABLE; cotización ficticia; confirmación; recibo e historial; desconexión de internet; retorno al conversor; conciliación por referencia; y separación de datos entre cuentas. Reportar las capturas sin información privada ni contraseñas.

**No usar esta APK para operaciones financieras ni distribuirla como versión comercial.**
