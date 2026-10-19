#!/usr/bin/env bash
# Ejercita ES y EN en un emulador con una app DEMO instalada,
# sin tocar contraseñas, cuentas ni credenciales.
set -euo pipefail
mkdir -p smoke-results
for locale in es en; do
  adb shell uiautomator dump /sdcard/mm-locale-before.xml >/dev/null
  adb pull /sdcard/mm-locale-before.xml smoke-results/locale-before.xml >/dev/null
  read -r x y <<<"$(python3 scripts/android_demo_locale_ui.py coords "$locale" smoke-results/locale-before.xml)"
  adb shell input tap "$x" "$y"
  sleep 2
  adb shell uiautomator dump /sdcard/mm-locale-after.xml >/dev/null
  adb pull /sdcard/mm-locale-after.xml "smoke-results/locale-$locale.xml" >/dev/null
  python3 scripts/android_demo_locale_ui.py verify "$locale" "smoke-results/locale-$locale.xml"
done
# Cerrar solo el proceso y abrir nuevamente: no borrar almacenamiento.
adb shell am force-stop com.monedamundial.demo
adb shell am start -W -n com.monedamundial.demo/.MainActivity > smoke-results/reopen-locale.txt
sleep 4
adb shell uiautomator dump /sdcard/mm-locale-reopen.xml >/dev/null
adb pull /sdcard/mm-locale-reopen.xml smoke-results/locale-reopen.xml >/dev/null
python3 scripts/android_demo_locale_ui.py verify en smoke-results/locale-reopen.xml
echo "PASS: cambio ES/EN y persistencia después de reinicio sin autenticación."
