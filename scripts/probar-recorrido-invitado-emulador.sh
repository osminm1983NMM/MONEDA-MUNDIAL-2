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

# Exercise public Coin buy/sell examples on the *installed* APK, not only
# Python/UI unit tests. No account, blockchain connection or real order.
read -r x y <<< "$(python3 scripts/android_guest_tour_contract.py coin-trade-entry smoke-results/guest-crypto-bottom.xml)"
echo "Abriendo simulación pública de compra/venta de Coin..."
adb shell input tap "$x" "$y"
sleep 3
# Switching nested views can preserve the parent ScrollView's old position.
adb shell input swipe 550 700 550 1900 500
sleep 2
read_accessibility guest-coin-buy
adb shell input swipe 550 1900 550 700 500
sleep 2
read_accessibility guest-coin-buy-bottom
python3 scripts/android_guest_tour_contract.py coin-trade-buy smoke-results/guest-coin-buy.xml smoke-results/guest-coin-buy-bottom.xml

# Selling is a second render: never validate the new state with the old XML.
adb shell input swipe 550 700 550 1900 500
sleep 2
read_accessibility guest-coin-before-sell
read -r x y <<< "$(python3 scripts/android_guest_tour_contract.py coin-trade-sell-entry smoke-results/guest-coin-before-sell.xml)"
adb shell input tap "$x" "$y"
sleep 2
read_accessibility guest-coin-sell
adb shell input swipe 550 1900 550 700 500
sleep 2
read_accessibility guest-coin-sell-bottom
python3 scripts/android_guest_tour_contract.py coin-trade-sell smoke-results/guest-coin-sell.xml smoke-results/guest-coin-sell-bottom.xml

read -r x y <<< "$(python3 scripts/android_guest_tour_contract.py coin-trade-back smoke-results/guest-coin-sell-bottom.xml)"
echo "Volviendo de la simulación a Coin y Digital..."
adb shell input tap "$x" "$y"
sleep 3
adb shell input swipe 550 700 550 1900 500
sleep 2
read_accessibility guest-crypto-return
adb shell input swipe 550 1900 550 700 500
sleep 2
read_accessibility guest-crypto-return-bottom
python3 scripts/android_guest_tour_contract.py crypto smoke-results/guest-crypto-return.xml smoke-results/guest-crypto-return-bottom.xml
read -r x y <<< "$(python3 scripts/android_guest_tour_contract.py crypto-back smoke-results/guest-crypto-return-bottom.xml)"
echo "Regresando desde Coin/Digital al recorrido de invitado..."
adb shell input tap "$x" "$y"
sleep 3
# Do not accept returning straight to login or another unintended screen.
read_accessibility guest-after-crypto
# Re-read this NEW visit's bottom content: reusing old tour XML would let
# an incorrect return screen pass merely because the original tour was valid.
adb shell input swipe 550 1900 550 700 500
sleep 2
read_accessibility guest-tour-return-ready
python3 scripts/android_guest_tour_contract.py tour smoke-results/guest-after-crypto.xml smoke-results/guest-tour-return-ready.xml

# Verificar panel público de requisitos; sigue sin iniciar sesión.
read -r x y <<< "$(python3 scripts/android_guest_tour_contract.py readiness-entry smoke-results/guest-tour-return-ready.xml)"
echo "Abriendo requisitos públicos sin cuenta..."
adb shell input tap "$x" "$y"
sleep 3
read_accessibility guest-readiness
adb shell input swipe 550 1900 550 700 500
sleep 2
read_accessibility guest-readiness-bottom
python3 scripts/android_guest_tour_contract.py readiness smoke-results/guest-readiness.xml smoke-results/guest-readiness-bottom.xml
read -r x y <<< "$(python3 scripts/android_guest_tour_contract.py readiness-back smoke-results/guest-readiness-bottom.xml)"
adb shell input tap "$x" "$y"
sleep 3
read_accessibility guest-after-readiness
adb shell input swipe 550 1900 550 700 500
sleep 2
read_accessibility guest-tour-return-ready
python3 scripts/android_guest_tour_contract.py tour smoke-results/guest-after-readiness.xml smoke-results/guest-tour-return-ready.xml
# El catálogo mundial es público. Verificar la pantalla REAL de este APK
# (no confundir pruebas unitarias con navegación Android).
read -r x y <<< "$(python3 scripts/android_guest_tour_contract.py world-entry smoke-results/guest-tour-return-ready.xml)"
echo "Abriendo catálogo mundial sin iniciar sesión..."
adb shell input tap "$x" "$y"
sleep 3
# Distintas densidades de pantalla muestran listas parciales: capturar ambas.
adb shell input swipe 550 700 550 1900 500
sleep 2
read_accessibility guest-world-top
adb shell input swipe 550 1900 550 700 500
sleep 2
read_accessibility guest-world-bottom
python3 scripts/android_guest_tour_contract.py world smoke-results/guest-world-top.xml smoke-results/guest-world-bottom.xml
read -r x y <<< "$(python3 scripts/android_guest_tour_contract.py world-back smoke-results/guest-world-bottom.xml)"
adb shell input tap "$x" "$y"
sleep 3
# Regresar desde una lista desplazada puede conservar la posición de ScrollView.
# Capturar de nuevo la cabecera ANTES de verificar los elementos del final.
adb shell input swipe 550 650 550 1900 550
sleep 2
read_accessibility guest-after-world
adb shell input swipe 550 1900 550 700 500
sleep 2
read_accessibility guest-tour-after-world-bottom
python3 scripts/android_guest_tour_contract.py tour smoke-results/guest-after-world.xml smoke-results/guest-tour-after-world-bottom.xml
# Vista previa de Historial, sin cuenta ni conexión financiera: filtros y comprobante.
bash scripts/probar-historial-invitado-emulador.sh
# Releer recorrido AHORA, después de volver, sin reutilizar capturas previas.
adb shell input swipe 550 650 550 1900 470
sleep 2
adb shell input swipe 550 650 550 1900 470
sleep 2
read_accessibility guest-after-history
adb shell input swipe 550 1900 550 650 470
sleep 2
adb shell input swipe 550 1900 550 650 470
sleep 2
read_accessibility guest-tour-after-history-bottom
python3 scripts/android_guest_tour_contract.py tour smoke-results/guest-after-history.xml smoke-results/guest-tour-after-history-bottom.xml
read -r x y <<< "$(python3 scripts/android_guest_tour_contract.py return-button smoke-results/guest-tour-after-history-bottom.xml)"
echo "Volviendo a la pantalla pública de inicio..."
adb shell input tap "$x" "$y"
sleep 3
read_accessibility guest-return
python3 scripts/android_guest_tour_contract.py return smoke-results/guest-return.xml
echo "OK: invitado → Coin/Digital → países → Historial ficticio → inicio, sin cuenta ni dinero."
