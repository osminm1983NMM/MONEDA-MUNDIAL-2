# Verificación de procedencia de APK Android (17/10/2026)

La prueba de arranque en emulador es **manual y de demostración**. Antes, el script elegía la última compilación exitosa, aun cuando correspondiera a otro commit. Esto podía producir un resultado verde de una versión anterior.

El flujo `.github/workflows/probar-apk-emulador.yml` ahora comprueba que el SHA de la APK independiente más reciente exitosa coincida con el SHA del código fuente que GitHub Actions está probando. Si difiere, la ejecución falla **sin instalar la APK anterior**.

## Cómo utilizar
1. Preparar la rama `desarrollo-comercios-20261013` y esperar que `APK Android independiente - pruebas` termine correctamente para el commit exacto.
2. Abrir GitHub Actions → **Probar APK instalada en Android** → Run workflow en **esa rama**, sin hacer commits adicionales después de la compilación.
3. Verificar que el workflow compare los SHA y guarde `smoke-results/compilacion-probada.txt`.
4. La prueba sólo instala, abre y comprueba ausencia de fallos fatales en un emulador. No prueba login, pago ficticio, verificación de códigos, compatibilidad de todos los Android, ni dinero real.

**Limitación:** si la última compilación APK exitosa es de un commit diferente, la prueba fallará hasta que se compile el commit actual. Eso es deliberado para evitar falsos positivos. Ningún flujo transmite dinero real.
