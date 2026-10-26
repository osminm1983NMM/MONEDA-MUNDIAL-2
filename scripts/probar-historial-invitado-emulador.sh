#!/usr/bin/env bash
# Misma interfaz de Historial con datos inventados. Nunca necesita contraseña.
set -euo pipefail
mkdir -p smoke-results

read_screen() {
  local name="$1"
  for attempt in 1 2 3; do
    adb shell uiautomator dump "/sdcard/mm-${name}.xml" >"smoke-results/${name}-dump.txt" 2>&1 || true
    if adb pull "/sdcard/mm-${name}.xml" "smoke-results/${name}.xml" >"smoke-results/${name}-pull.txt" 2>&1 &&
       [ -s "smoke-results/${name}.xml" ]; then
      return 0
    fi
    sleep 2
  done
  return 1
}

find_and_tap() {
  local action="$1"
  local position=""
  local name="history-look-${action}"
  # Comenzar desde arriba para no omitir filtros al volver de una captura
  # que deja el historial al fondo. Cada intento usa XML nuevo.
  for pass in 1 2 3 4; do
    adb shell input swipe 550 650 550 1900 470
    sleep 1
  done
  for attempt in 1 2 3 4 5 6 7 8; do
    read_screen "$name"
    if position="$(python3 scripts/android_history_preview_contract.py "$action" "smoke-results/${name}.xml" 2>/dev/null)"; then
      read -r x y <<< "$position"
      echo "Pulsando $action en $x,$y"
      adb shell input tap "$x" "$y"
      sleep 3
      return 0
    fi
    adb shell input swipe 550 1900 550 700 420
    sleep 2
  done
  echo "::error::No se encontró el control visible: $action"
  return 1
}

capture_three() {
  local name="$1"
  adb shell input swipe 550 650 550 1900 470
  sleep 2
  adb shell input swipe 550 650 550 1900 470
  sleep 2
  read_screen "${name}-top"
  adb exec-out screencap -p > "smoke-results/${name}-top.png" || true
  adb shell input swipe 550 1900 550 650 470
  sleep 2
  read_screen "${name}-mid"
  adb shell input swipe 550 1900 550 650 470
  sleep 2
  read_screen "${name}-bottom"
}

find_and_tap history-entry
capture_three guest-history
python3 scripts/android_history_preview_contract.py overview smoke-results/guest-history-top.xml smoke-results/guest-history-mid.xml smoke-results/guest-history-bottom.xml

# Activar filtros en la APK instalada, comprobar resultados después de cada pulsación.
adb shell input swipe 550 650 550 1900 470
sleep 2
find_and_tap incoming-entry
capture_three guest-history-incoming
python3 scripts/android_history_preview_contract.py incoming smoke-results/guest-history-incoming-top.xml smoke-results/guest-history-incoming-mid.xml smoke-results/guest-history-incoming-bottom.xml

adb shell input swipe 550 650 550 1900 470
sleep 2
find_and_tap outgoing-entry
capture_three guest-history-outgoing
python3 scripts/android_history_preview_contract.py outgoing smoke-results/guest-history-outgoing-top.xml smoke-results/guest-history-outgoing-mid.xml smoke-results/guest-history-outgoing-bottom.xml

adb shell input swipe 550 650 550 1900 470
sleep 2
find_and_tap merchant-entry
capture_three guest-history-merchant
python3 scripts/android_history_preview_contract.py merchant smoke-results/guest-history-merchant-top.xml smoke-results/guest-history-merchant-mid.xml smoke-results/guest-history-merchant-bottom.xml

find_and_tap receipt-entry
capture_three guest-history-receipt
python3 scripts/android_history_preview_contract.py receipt smoke-results/guest-history-receipt-top.xml smoke-results/guest-history-receipt-mid.xml smoke-results/guest-history-receipt-bottom.xml

find_and_tap history-back
echo "OK: recorrido → Historial inventado → filtros → comprobante ficticio → recorrido"
