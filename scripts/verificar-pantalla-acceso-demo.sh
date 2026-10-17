#!/usr/bin/env bash
# Fail-closed check that a fresh Android emulator actually rendered the DEMO login.
# Only validates a test instance without credentials; never reads account secrets.
set -euo pipefail
UI_XML="${1:-smoke-results/ui.xml}"
SCREENSHOT="${2:-smoke-results/initial-screen.png}"

if [[ ! -s "$SCREENSHOT" ]]; then
  echo "::error::El emulador no generó una captura de pantalla."
  exit 1
fi
if [[ ! -s "$UI_XML" ]]; then
  echo "::error::No se pudo leer el árbol accesible de la pantalla Android."
  exit 1
fi
if ! grep -Fq 'MONEDA MUNDIAL' "$UI_XML"; then
  echo "::error::La marca MONEDA MUNDIAL no aparece en la pantalla inicial."
  exit 1
fi
if ! grep -Eq 'Accede a Moneda Mundial|Iniciar sesi[oó]n|Crear cuenta de prueba' "$UI_XML"; then
  echo "::error::La pantalla de acceso de prueba no aparece. Puede haber una pantalla vacía o una carga atascada."
  exit 1
fi
echo 'OK: la marca y la pantalla de acceso DEMO son visibles en el emulador.'
