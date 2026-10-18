#!/usr/bin/env bash
# Android DEMO smoke: instalación/arranque sin cuenta, fondos ni secretos.
set -euo pipefail
apk="${APK_PATH:-apk-test/app-release.apk}"
app="com.monedamundial.demo"
mkdir -p smoke-results
test -s "$apk"

unzip -tq "$apk" > smoke-results/apk-integridad.txt
unzip -Z1 "$apk" > smoke-results/apk-entradas.txt
grep -qx 'assets/index.android.bundle' smoke-results/apk-entradas.txt || {
  echo "::error::Falta bundle JavaScript integrado"; exit 1;
}

adb install -r "$apk" | tee smoke-results/instalacion.txt
adb shell pm path "$app" > smoke-results/paquete.txt
grep -q '^package:' smoke-results/paquete.txt || {
  echo "::error::No se instaló la app DEMO"; exit 1;
}
adb logcat -c || true
adb shell am force-stop "$app" || true
adb shell am start -W -n "$app/.MainActivity" | tee smoke-results/arranque.txt
if grep -Eqi 'Status: timeout|Error type|Unable to resolve|Activity not started' smoke-results/arranque.txt; then
  echo "::error::Falló el inicio Android"; exit 1;
fi
sleep 24
adb exec-out screencap -p > smoke-results/inicio.png
test -s smoke-results/inicio.png || { echo "::error::Pantalla vacía"; exit 1; }

# Accesibilidad puede tardar tras instalar un APK compilado para release.
found=false
for attempt in 1 2 3; do
  adb shell uiautomator dump /sdcard/moneda-ui.xml > smoke-results/uiautomator.log 2>&1 || true
  if adb pull /sdcard/moneda-ui.xml smoke-results/ui.xml >/dev/null 2>&1 && [ -s smoke-results/ui.xml ]; then
    if grep -Fq 'MONEDA MUNDIAL' smoke-results/ui.xml &&
       grep -Fq 'SOLO DEMOSTRACIÓN' smoke-results/ui.xml &&
       grep -Eq 'Accede a Moneda Mundial|Iniciar sesi[oó]n|Crear cuenta de prueba' smoke-results/ui.xml; then
      found=true
      break
    fi
  fi
  sleep 5
done
adb logcat -d -s AndroidRuntime:E ReactNativeJS:E >smoke-results/errores-android.txt || true
if grep -Eqi 'not responding|no responde|Application Not Responding' smoke-results/ui.xml 2>/dev/null; then
  echo "::error::Diálogo Android ANR presente"; exit 1
fi
if ! adb shell pidof "$app" >/dev/null 2>&1; then
  echo "::error::El proceso Android ya no está abierto"; exit 1
fi
if grep -Eq 'FATAL EXCEPTION|Unable to load script|Invariant Violation|Uncaught Error' smoke-results/errores-android.txt; then
  echo "::error::Fallo de ejecución Android"; exit 1
fi
if [ "$found" != true ]; then
  echo "::error::No se verificó marca + aviso SOLO DEMOSTRACIÓN + acceso en pantalla real"; exit 1
fi
echo "OK: APK DEMO instalada, iniciada y advertencia visible. NO prueba cuentas autenticadas ni conversiones."
