# Etapa 141 — Historial responsive en Android DEMO

## Hallazgo en prueba manual Samsung (24 de octubre de 2026)

En la vista previa de Historial sin cuenta, el botón «Salidas» quedaba fuera del ancho visible. El título de «Transferencia recibida» podía dividirse a mitad de palabra por competir horizontalmente con el importe y el icono.

## Ajuste

- Los filtros `Todos`, `Entradas`, `Salidas` y `Comercios` se presentan en dos columnas con ajuste de línea; ya no requieren desplazamiento horizontal.
- El nombre del movimiento ocupa la fila superior junto al icono. En la fila inferior se distribuyen fecha/etiqueta e importe, reduciendo las particiones de palabras con letra grande.
- Los ejemplos del historial de invitado siguen siendo ficticios y locales. No cambian saldos, autenticación, transferencias, Supabase ni permisos.
- La prueba Android del emulador ahora pulsa explícitamente «Salidas» y exige tres movimientos, además de los controles anteriores de entradas, comercios y comprobantes.

## Validación y límites

- `npm test`: 96 pruebas Node correctas.
- `python3 -m unittest discover -s tests -p test_android_history_preview_contract.py`: 3 pruebas correctas.
- `bash -n scripts/probar-historial-invitado-emulador.sh` y `git diff --check`: correctos.
- **Pendiente**: compilación Android y recorrido real en emulador para este commit; después, revisión visual en Samsung.
- APK de demostración con firma Android Debug: **no publicar**. Cada compilación podría tener un certificado diferente y no actualizar una instalación anterior. No desinstalar ni borrar almacenamiento del teléfono sin comprobar qué datos locales se perderían.
