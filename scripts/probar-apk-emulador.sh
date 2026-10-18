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
# Un lanzamiento que agotó tiempo no puede considerarse una prueba aprobada,
# aunque un proceso Android continúe ejecutándose en segundo plano.
if grep -Eqi 'Status: timeout|Error type|Unable to resolve|Activity not started' smoke-results/launch.txt; then
  echo "::error::El arranque de Android falló o agotó el tiempo permitido."
  exit 1
fi
sleep 24

echo "Capturando evidencias sin iniciar sesión..."
adb exec-out screencap -p > smoke-results/initial-screen.png || true

# El emulador lento puede crear el archivo XML pero fallar en el primer
# adb pull. Reintentar sin aprobar falsamente una pantalla no comprobada.
ui_ok=false
for attempt in 1 2 3; do
  echo "Lectura de accesibilidad Android, intento $attempt de 3"
  adb shell uiautomator dump /sdcard/moneda-mundial-ui.xml >smoke-results/ui-dump-output.txt 2>&1 || true
  if adb pull /sdcard/moneda-mundial-ui.xml smoke-results/ui.xml >>smoke-results/ui-pull-log.txt 2>&1 &&
     [ -s smoke-results/ui.xml ]; then
    ui_ok=true
    break
  fi
  sleep 3
done
if [ "$ui_ok" != "true" ]; then
  echo "::error::Android no entregó el árbol accesible después de 3 intentos."
  adb shell ls -l /sdcard/moneda-mundial-ui.xml || true
  cat smoke-results/ui-dump-output.txt || true
  cat smoke-results/ui-pull-log.txt || true
  exit 1
fi
adb logcat -d -s AndroidRuntime:E ReactNativeJS:E >smoke-results/runtime-errors.txt || true
adb shell dumpsys window >smoke-results/window-state.txt 2>&1 || true
# 'LAST ANR' en dumpsys puede ser histórico. Solo importa el diálogo ACTUAL.
# Un ANR del launcher del emulador puede interponerse durante el arranque;
# permitir UNA recuperación controlada exclusivamente para Pixel Launcher.
anr_status="$(python3 scripts/android_anr_triage.py classify smoke-results/ui.xml smoke-results/window-state.txt)"
if [ "$anr_status" = "launcher_anr" ]; then
  echo "::warning::El ANR pertenece a Pixel Launcher, no a Moneda Mundial. Recuperación CI única."
  read -r touch_x touch_y <<< "$(python3 scripts/android_anr_triage.py launcher-close-coordinates smoke-results/ui.xml smoke-results/window-state.txt)"
  adb shell input tap "$touch_x" "$touch_y"
  sleep 3
  adb shell am start -W -n "$APP_ID/.MainActivity" >smoke-results/relaunch.txt
  sleep 10
  adb shell uiautomator dump /sdcard/moneda-mundial-ui.xml >smoke-results/ui-dump-output.txt 2>&1
  adb pull /sdcard/moneda-mundial-ui.xml smoke-results/ui.xml >>smoke-results/ui-pull-log.txt 2>&1
  adb shell dumpsys window >smoke-results/window-state.txt 2>&1
  anr_status="$(python3 scripts/android_anr_triage.py classify smoke-results/ui.xml smoke-results/window-state.txt)"
fi
if [ "$anr_status" != "none" ]; then
  echo "::error::ANR activo ($anr_status). APK NO verificada."
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
