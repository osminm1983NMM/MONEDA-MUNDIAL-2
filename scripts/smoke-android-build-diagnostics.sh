#!/usr/bin/env bash
# Verifica la procedencia PUBLICA de la APK directamente en la pantalla Android.
# No inicia sesión, no toca contraseñas ni envía operaciones.
set -euo pipefail
: "${GITHUB_SHA:?Falta SHA de GitHub}"
: "${GITHUB_RUN_ID:?Falta ID del flujo}"
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$GITHUB_RUN_ID" =~ ^[1-9][0-9]{0,19}$ ]] || exit 2
mkdir -p smoke-results

# Se permite desplazarse por el ScrollView; NUNCA se utilizan coordenadas
# adivinadas para tocar botones. El centro procede de accesibilidad Android.
found=false
for attempt in 1 2 3 4; do
  adb shell uiautomator dump /sdcard/mm-diagnostic-before.xml > /dev/null
  adb pull /sdcard/mm-diagnostic-before.xml smoke-results/diagnostic-before.xml > /dev/null
  if coords="$(python3 scripts/android_demo_build_ui.py coords smoke-results/diagnostic-before.xml 2>/dev/null)"; then
    read -r x y <<< "$coords"
    adb shell input tap "$x" "$y"
    found=true
    break
  fi
  adb shell input swipe 540 1780 540 660 330
  sleep 2
done
if [ "$found" != true ]; then
  echo "::error::Botón de diagnóstico APK no encontrado de forma segura"; exit 1
fi

# El diagnóstico puede quedar debajo de la ventana visible. Leer los textos
# mostrados, deslizar con límite y rechazar SHA/run distintos al de ESTA APK.
verified=false
for attempt in 1 2 3 4; do
  sleep 2
  adb shell uiautomator dump /sdcard/mm-diagnostic-after.xml > /dev/null
  adb pull /sdcard/mm-diagnostic-after.xml smoke-results/diagnostic-after.xml > /dev/null
  if python3 scripts/android_demo_build_ui.py verify smoke-results/diagnostic-after.xml "$GITHUB_SHA" "$GITHUB_RUN_ID" >/dev/null 2>&1; then
    verified=true
    break
  fi
  adb shell input swipe 540 1780 540 660 330
done
if [ "$verified" != true ]; then
  echo "::error::El diagnóstico visible no coincide con la procedencia GitHub de la APK"; exit 1
fi
echo "PASS: aviso DEMO y commit/run exactos de esta compilación visibles sin iniciar sesión."
