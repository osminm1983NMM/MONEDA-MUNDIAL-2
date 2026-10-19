#!/usr/bin/env bash
# Verificación de texto REAL obtenido mediante uiautomator (sin OCR).
# Solo permite pantalla de inicio de sesión cuando marca, aviso de fondos
# ficticios e invitación a entrar coinciden EN EL MISMO idioma.
verify_demo_launch_ui() {
  local file="${1:-}"
  [ -n "$file" ] && [ -s "$file" ] || return 1
  grep -Fq 'MONEDA MUNDIAL' "$file" || return 1
  if grep -Fq 'SOLO DEMOSTRACIÓN' "$file" &&
     grep -Fq 'SIN DINERO REAL' "$file" &&
     grep -Eq 'Accede a Moneda Mundial|Iniciar sesi[oó]n|Crear cuenta de prueba' "$file"; then
    return 0
  fi
  if grep -Fq 'DEMO ONLY' "$file" &&
     grep -Fq 'NO REAL MONEY' "$file" &&
     grep -Eq 'Welcome to Moneda Mundial|Sign in|Create test account' "$file"; then
    return 0
  fi
  return 1
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  [ "$#" -eq 1 ] || { echo 'Uso: check-demo-launch-ui.sh ruta/al/ui.xml' >&2; exit 2; }
  if verify_demo_launch_ui "$1"; then
    echo 'OK: marca + aviso sin dinero real + acceso, en ES o EN'
  else
    echo 'FALLO: faltan los tres controles visibles de la misma lengua' >&2
    exit 1
  fi
fi
