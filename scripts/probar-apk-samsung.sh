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
# The safe-area layout can put the registration button below the fold.
# Verify the identity and login in the initial viewport, then reach registration
# by scrolling if needed. Never accept a launcher, blank screen or crash.
expected_commit=${GITHUB_SHA:?Expected build commit required}
: "${RUNNER_TEMP:?RUNNER_TEMP required}"
dump_ui() {
  local target=$1
  rm -f "$target"
  adb shell rm -f /sdcard/mwd-ui.xml
  adb shell uiautomator dump /sdcard/mwd-ui.xml >/dev/null &&
    adb shell cat /sdcard/mwd-ui.xml > "$target" &&
    grep -Fq "$package" "$target"
}
diagnose() {
  local launch=$1
  echo "ERROR: no se verificaron todos los controles de acceso en apertura $launch" >&2
  adb shell dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity' || true
  adb logcat -d -t 500 > "$RUNNER_TEMP/mwd-logcat-failure.txt" || true
  adb exec-out screencap -p > "$RUNNER_TEMP/mwd-failure.png" || true
  if [[ -s "$RUNNER_TEMP/mwd-ui.xml" ]]; then
    cp "$RUNNER_TEMP/mwd-ui.xml" "$RUNNER_TEMP/mwd-ui-failure.xml"
    echo 'Textos visibles en el emulador sintético:'
    grep -o 'text="[^"]*"' "$RUNNER_TEMP/mwd-ui-failure.xml" | head -40 || true
  fi
}
for launch in 1 2; do
  adb shell am force-stop "$package"
  adb shell am start -W -n "$package/.MainActivity"
  identity=false
  login=false
  register=false
  for attempt in {1..20}; do
    if dump_ui "$RUNNER_TEMP/mwd-ui.xml" &&
       grep -Fq "$expected_commit" "$RUNNER_TEMP/mwd-ui.xml" &&
       grep -Fq 'SOLO DEMOSTRACIÓN' "$RUNNER_TEMP/mwd-ui.xml"; then
      identity=true
      cp "$RUNNER_TEMP/mwd-ui.xml" "$RUNNER_TEMP/mwd-identity.xml"
      if grep -Fq 'Iniciar sesión' "$RUNNER_TEMP/mwd-ui.xml"; then login=true; fi
      if grep -Fq 'Crear cuenta de prueba' "$RUNNER_TEMP/mwd-ui.xml"; then register=true; fi
      if [[ "$login" == true ]]; then break; fi
    fi
    sleep 2
  done
  if [[ "$identity" == true && "$login" == true && "$register" != true ]]; then
    for attempt in {1..3}; do
      adb shell input swipe 540 1750 540 650 400
      sleep 1
      if dump_ui "$RUNNER_TEMP/mwd-ui.xml" &&
         grep -Fq 'Crear cuenta de prueba' "$RUNNER_TEMP/mwd-ui.xml"; then
        register=true
        break
      fi
    done
  fi
  if [[ "$identity" != true || "$login" != true || "$register" != true ]]; then
    echo "Identidad=$identity Inicio=$login Registro=$register" >&2
    diagnose "$launch"
    exit 1
  fi
  echo "Apertura $launch verificada: identidad, inicio y registro"
done
# Restore the top viewport for the final screenshot and identity check.
adb shell input swipe 540 650 540 2100 400
adb shell input swipe 540 650 540 2100 400
sleep 1
dump_ui "$RUNNER_TEMP/mwd-ui.xml"
grep -Fq "$expected_commit" "$RUNNER_TEMP/mwd-ui.xml"
adb exec-out screencap -p > "$RUNNER_TEMP/inicio.png"
