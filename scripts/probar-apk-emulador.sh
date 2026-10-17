#!/usr/bin/env bash
# Prueba automatizada de un APK de DEMOSTRACIÓN en emulador Android.
# Nunca envía dinero real ni utiliza credenciales de usuarios.
set -euo pipefail
APK_PATH="${APK_PATH:-apk-test/app-release.apk}"
APP_ID="com.monedamundial.app"
mkdir -p smoke-results

if [ ! -f "$APK_PATH" ]; then
  echo "::error::No se encontró la APK descargada: $APK_PATH"
  exit 1
fi

echo "Verificando integridad de la APK..."
unzip -tq "$APK_PATH" >smoke-results/integrity.txt
# Evitar el código 141 de SIGPIPE: con pipefail, grep -q cierra
# antes de que unzip termine de enumerar las entradas de la APK.
unzip -Z1 "$APK_PATH" >smoke-results/apk-entries.txt
if ! grep -qx 'assets/index.android.bundle' smoke-results/apk-entries.txt; then
  echo "::error::La APK no contiene el bundle JavaScript independiente."
  exit 1
fi

echo "Instalando aplicación de demostración..."
adb install -r "$APK_PATH" | tee smoke-results/install.txt
adb shell pm path "$APP_ID" | tee smoke-results/package.txt
if ! grep -q '^package:' smoke-results/package.txt; then
  echo "::error::Android no encuentra el paquete instalado."
  exit 1
fi

echo "Abriendo la pantalla inicial..."
adb shell am force-stop "$APP_ID" || true
adb logcat -c || true
adb shell am start -W -n "$APP_ID/.MainActivity" | tee smoke-results/launch.txt
sleep 24

echo "Capturando evidencias sin iniciar sesión..."
adb exec-out screencap -p > smoke-results/initial-screen.png || true
adb shell uiautomator dump /sdcard/moneda-mundial-ui.xml >smoke-results/ui-dump-output.txt 2>&1 || true
adb pull /sdcard/moneda-mundial-ui.xml smoke-results/ui.xml >/dev/null 2>&1 || true
adb logcat -d -s AndroidRuntime:E ReactNativeJS:E >smoke-results/runtime-errors.txt || true
adb shell dumpsys window >smoke-results/window-state.txt 2>&1 || true
if grep -Eqi "Application Not Responding|isn.t responding|is not responding|not responding" smoke-results/window-state.txt; then
  echo "::error::El sistema Android informa ventana ANR, no es una prueba válida."
  exit 1
fi

# Comprobación básica de instalación y apertura; no certifica flujos autenticados.
if ! adb shell pidof "$APP_ID" >/dev/null 2>&1; then
  echo "::error::La aplicación no siguió ejecutándose después del arranque."
  cat smoke-results/runtime-errors.txt || true
  exit 1
fi
if grep -Eq 'FATAL EXCEPTION|Unable to load script|Invariant Violation|Uncaught Error' smoke-results/runtime-errors.txt; then
  echo "::error::Android registró un fallo fatal durante la apertura."
  cat smoke-results/runtime-errors.txt
  exit 1
fi

bash scripts/verificar-pantalla-acceso-demo.sh smoke-results/ui.xml smoke-results/initial-screen.png

echo "RESULTADO: APK abierta y pantalla de acceso DEMO detectada. Flujos de cuentas pendientes de prueba manual."
