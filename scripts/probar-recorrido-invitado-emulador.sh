#!/usr/bin/env bash
# DEMO-only guest navigation; never signs in or submits financial transactions.
set -euo pipefail
mkdir -p smoke-results

coordinates="$(python3 scripts/android_guest_tour_contract.py locate smoke-results/ui.xml)"
read -r x y <<< "$coordinates"
echo "Abriendo recorrido público de demostración..."
adb shell input tap "$x" "$y"
sleep 4

read_accessibility() {
  local label="$1"
  local remote="/sdcard/moneda-mundial-${label}.xml"
  local localfile="smoke-results/${label}.xml"
  for attempt in 1 2 3; do
    adb shell uiautomator dump "$remote" >"smoke-results/${label}-dump.txt" 2>&1 || true
    if adb pull "$remote" "$localfile" >>"smoke-results/${label}-pull.txt" 2>&1 && [ -s "$localfile" ]; then
      return 0
    fi
    sleep 2
  done
  echo "::error::No se pudo recuperar pantalla Android: $label"
  return 1
}

adb exec-out screencap -p >smoke-results/guest-tour.png || true
read_accessibility guest-tour
# A long ScrollView may expose only a subset of its children; scroll down
# and read a second accessibility snapshot before evaluating tour content.
adb shell input swipe 550 1900 550 700 550
sleep 2
read_accessibility guest-tour-bottom
python3 scripts/android_guest_tour_contract.py tour smoke-results/guest-tour.xml smoke-results/guest-tour-bottom.xml

# Explore newly added crypto research screen WITHOUT signing in or transacting.
# The tour was scrolled to the bottom, where its Coin/Digital button is visible.
read -r x y <<< "$(python3 scripts/android_guest_tour_contract.py crypto-entry smoke-results/guest-tour-bottom.xml)"
echo "Abriendo sección pública Coin y Digital (sin cuenta)..."
adb shell input tap "$x" "$y"
sleep 3
adb exec-out screencap -p >smoke-results/guest-crypto.png || true
read_accessibility guest-crypto
# Android ScrollView may expose content in either top or bottom viewport.
adb shell input swipe 550 1900 550 700 500
sleep 2
read_accessibility guest-crypto-bottom
python3 scripts/android_guest_tour_contract.py crypto smoke-results/guest-crypto.xml smoke-results/guest-crypto-bottom.xml

read -r x y <<< "$(python3 scripts/android_guest_tour_contract.py crypto-back smoke-results/guest-crypto-bottom.xml)"
echo "Regresando desde Coin/Digital al recorrido de invitado..."
adb shell input tap "$x" "$y"
sleep 3
# Do not accept returning straight to login or another unintended screen.
read_accessibility guest-after-crypto
python3 scripts/android_guest_tour_contract.py tour smoke-results/guest-tour.xml smoke-results/guest-after-crypto.xml

# Tour's return-to-login button can be below the visible viewport.
adb shell input swipe 550 1900 550 700 500
sleep 2
read_accessibility guest-tour-return-ready
read -r x y <<< "$(python3 scripts/android_guest_tour_contract.py return-button smoke-results/guest-tour-return-ready.xml)"
echo "Volviendo a la pantalla pública de inicio..."
adb shell input tap "$x" "$y"
sleep 3
read_accessibility guest-return
python3 scripts/android_guest_tour_contract.py return smoke-results/guest-return.xml
echo "OK: invitado → recorrido → Coin/Digital → recorrido → inicio, sin cuenta ni dinero."
