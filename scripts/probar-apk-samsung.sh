#!/usr/bin/env bash
set -euo pipefail
apk=${1:?Indica la ruta de la APK}
package=com.monedamundial.lab.samsung
timeout 360 adb wait-for-device
timeout 360 bash -c 'until adb shell getprop sys.boot_completed | grep -q 1; do sleep 2; done'
adb shell input keyevent 82
adb shell wm size 1080x2400
adb shell wm density 360
abis=$(adb shell getprop ro.product.cpu.abilist)
echo "ABI disponibles: $abis"
[[ "$abis" == *arm64-v8a* ]]
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
