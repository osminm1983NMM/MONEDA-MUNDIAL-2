# Pruebas Android — Moneda Mundial 2.0 (solo DEMO)

**Estado:** pendiente de ejecutar. Este documento no certifica una compilación ni pruebas en un teléfono.

## Antes de empezar
- Trabajar únicamente con la rama `pruebas-contabilidad-mwd`; no publicar ni modificar `main`.
- Confirmar que las cuentas A y B son de laboratorio y que los saldos MWD/COIN/DIGITAL son ficticios.
- No introducir dinero real, credenciales de producción ni crear recursos con costo sin autorización.
- Verificar `npm install`, `npx expo-doctor` y `npx expo export --platform android` en un entorno de compilación disponible. Registrar errores antes de intentar una APK.
- Si se autoriza una compilación, usar el perfil `preview` de `eas.json`, verificar el archivo APK y probarlo en Samsung antes de desinstalar versiones anteriores.

## Matriz de pruebas manuales (marcar después de ejecutarlas)
| Caso | Procedimiento | Resultado esperado | Estado |
| --- | --- | --- | --- |
| A1 | Entrar en cuenta A y consultar billetera | Solo saldos e historial de A | Pendiente |
| A2 | Solicitar cotización ficticia COIN → DIGITAL | Importe, comisión y vencimiento válidos | Pendiente |
| A3 | Pulsar rápidamente «Solicitar cotización» dos veces | No se envían dos solicitudes concurrentes | Pendiente |
| A4 | Intentar cambiar cantidad u origen mientras cotiza | Controles bloqueados temporalmente | Pendiente |
| A5 | Confirmar una conversión de prueba una vez | Una sola operación y saldos actualizados | Pendiente |
| A6 | Cerrar la app tras iniciar confirmación; reabrir | Recupera referencia y permite consultar estado | Pendiente |
| A7 | Cambiar de A a B durante una consulta | Ningún dato o aviso de A contamina B | Pendiente |
| B1 | Entrar en B y consultar billetera | Solo saldos e historial de B | Pendiente |
| B2 | Solicitar cotización DIGITAL → COIN | Datos válidos, sin dinero real | Pendiente |
| B3 | Repetir confirmación de una cotización ya ejecutada | No duplica el movimiento | Pendiente |
| E1 | Simular error de red tras confirmación | Referencia conservada; conciliación antes de repetir | Pendiente |
| E2 | Simular fallo de lectura de almacenamiento local | Conversiones bloqueadas y botón de recuperación | Pendiente |
| E3 | Cotización vencida | No se permite confirmar; solicitar una nueva | Pendiente |
| E4 | Fallo al actualizar saldos después de confirmar | Informa que la operación se registró; no la llama fallida | Pendiente |

## Evidencias requeridas
Registrar versión/commit, fecha, dispositivo, capturas del resultado, errores de compilación y saldos de prueba antes/después. No marcar «aprobado» hasta observar el resultado real.
