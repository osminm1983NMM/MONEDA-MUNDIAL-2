# Prueba de arranque Android automática (17/10/2026)

Al compilar la APK DEMO independiente, GitHub Actions ahora ejecuta automáticamente un segundo trabajo que obtiene **el APK generado por el mismo run y commit**, lo instala y abre en un emulador Android aislado.

La prueba falla si no puede instalar, abrir o mantener el proceso vivo, o si observa señales definidas de error fatal. Guarda evidencias de arranque en el artifact `moneda-mundial-android-smoke-test` (7 días).

La validación:
- Nunca toma una APK vieja de otra ejecución.
- No requiere credenciales, ni saldos ni cuentas reales.
- NO verifica funciones con sesión, dos usuarios, retiros, integraciones de proveedores o movimiento de dinero.
- NO garantiza que funcione en todos los teléfonos Samsung; sigue siendo necesaria una prueba manual real.

La tarea se añade sólo al flujo de APK independiente de `desarrollo-comercios-20261013`; no activa servicios financieros reales.