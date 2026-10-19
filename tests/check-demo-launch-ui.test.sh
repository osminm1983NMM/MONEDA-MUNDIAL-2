#!/usr/bin/env bash
set -euo pipefail
. scripts/check-demo-launch-ui.sh
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
printf '<hierarchy text="MONEDA MUNDIAL" content-desc="SOLO DEMOSTRACIÓN • SIN DINERO REAL Accede a Moneda Mundial"/>' > "$dir/es.xml"
printf '<hierarchy text="MONEDA MUNDIAL" content-desc="DEMO ONLY • NO REAL MONEY Welcome to Moneda Mundial"/>' > "$dir/en.xml"
printf '<hierarchy text="MONEDA MUNDIAL" content-desc="DEMO ONLY • NO REAL MONEY Accede a Moneda Mundial"/>' > "$dir/mixed.xml"
printf '<hierarchy text="MONEDA MUNDIAL" content-desc="DEMO ONLY Welcome to Moneda Mundial"/>' > "$dir/unsafe.xml"
printf '<hierarchy text="MONEDA MUNDIAL" content-desc="Welcome to Moneda Mundial"/>' > "$dir/no-warning.xml"
verify_demo_launch_ui "$dir/es.xml"
verify_demo_launch_ui "$dir/en.xml"
for file in mixed unsafe no-warning; do
 if verify_demo_launch_ui "$dir/$file.xml"; then
  echo "ERROR: pantalla insegura aceptada ($file)" >&2; exit 1
 fi
done
echo 'PASS: verificador ES/EN exige marca + aviso completo de fondos ficticios + acceso.'
