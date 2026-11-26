#!/usr/bin/env bash
set -euo pipefail
apk=${1:?Indica la ruta de la APK}
package=com.monedamundial.lab.samsung
echo 'Esperando conexión ADB del emulador'
if ! timeout 480 adb wait-for-device; then
  adb devices -l
  echo 'ERROR: el emulador no se conectó a ADB' >&2
  exit 124
fi
echo 'Esperando arranque completo de Android'
if ! timeout 600 bash -c 'until adb shell getprop sys.boot_completed | tr -d "\r" | grep -qx 1; do sleep 3; done'; then
  adb devices -l
  adb shell getprop sys.boot_completed || true
  adb logcat -d -t 150 || true
  echo 'ERROR: Android no completó el arranque' >&2
  exit 124
fi
echo 'Android arrancado'
adb shell input keyevent 82
adb shell wm size 1080x2400
adb shell wm density 360
abis=$(adb shell getprop ro.product.cpu.abilist)
echo "ABI disponibles: $abis"
[[ "$abis" == *arm64-v8a* || "$abis" == *x86_64* ]]
adb install "$apk"
for launch in 1 2; do
  adb shell am force-stop "$package"
  adb shell am start -W -n "$package/.MainActivity"
  visible=false
  for attempt in {1..12}; do
    if adb shell uiautomator dump /sdcard/mwd-ui.xml >/dev/null &&
       adb shell cat /sdcard/mwd-ui.xml > "$RUNNER_TEMP/mwd-ui.xml" &&
       grep -q "$package" "$RUNNER_TEMP/mwd-ui.xml" &&
       grep -q 'Iniciar sesión' "$RUNNER_TEMP/mwd-ui.xml" &&
       grep -q 'Crear cuenta de prueba' "$RUNNER_TEMP/mwd-ui.xml"; then
      visible=true
      break
    fi
    sleep 2
  done
  if [[ "$visible" != true ]]; then
    adb logcat -d -s ReactNativeJS:E AndroidRuntime:E
    exit 1
  fi
  echo "Apertura $launch verificada"
done
adb exec-out screencap -p > "$RUNNER_TEMP/inicio.png"
