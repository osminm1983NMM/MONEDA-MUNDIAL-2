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
python3 scripts/android_guest_tour_contract.py tour smoke-results/guest-tour.xml

# Find return button in the accessible screen; the exact language is irrelevant.
read -r x y < <(python3 - smoke-results/guest-tour.xml <<'PY'
import re,sys,xml.etree.ElementTree as E
p=sys.argv[1]
for n in E.parse(p).iter("node"):
 a=n.attrib
 txt=(a.get('text','')+' '+a.get('content-desc','')).lower()
 if a.get('clickable')=='true' and ('back to sign in' in txt or 'volver a iniciar sesión' in txt):
  m=re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',a.get('bounds',''))
  if m:
   x0,y0,x1,y1=map(int,m.groups())
   if x1>x0 and y1>y0:
    print((x0+x1)//2,(y0+y1)//2)
    sys.exit(0)
sys.exit('No se encontró botón de regreso del recorrido DEMO')
PY
)
echo "Volviendo a la pantalla pública de inicio..."
adb shell input tap "$x" "$y"
sleep 3
read_accessibility guest-return
python3 scripts/android_guest_tour_contract.py return smoke-results/guest-return.xml
echo "OK: navegación invitado → recorrido informativo → inicio, sin cuenta ni dinero."
