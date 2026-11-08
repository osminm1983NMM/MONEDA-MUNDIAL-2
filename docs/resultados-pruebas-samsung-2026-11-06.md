# Resultados de pruebas manuales — Samsung — 2026-11-06

## Contexto
APK Android LAB 2.0.1 (2) compilada exitosamente por Expo con perfil `preview` y rama `fix/swap-confirmation-recovery`. El usuario confirmó instalación y apertura en Samsung. **Solo créditos ficticios**.

## Observaciones documentadas por capturas
1. Inicio de sesión de cuenta A exitoso; saldo inicial observado: 10,104.00 MWD.
2. Transferencia ficticia de 1.00 MWD desde cuenta A: mensaje de confirmación y movimiento de salida de −1.00 MWD a las 13:34:40.
3. Saldo de cuenta A después de transferencia: 10,103.00 MWD.
4. Cuenta B abrió correctamente; saldo observado: 9,895.00 MWD. Historial registra entrada de +1.00 MWD a las 13:34:40. No hay captura de saldo B previo a esa transferencia.
5. Conversión COIN → DIGITAL: COIN 97.000000 → 96.000000; DIGITAL 1000.374061 → 1000.498748 (incremento 0.124687).
6. Conversión DIGITAL → COIN: DIGITAL 1000.498748 → 999.498748; COIN 96.000000 → 103.980000 (incremento 7.980000).
7. Segunda conversión DIGITAL → COIN confirmada intencionalmente por el usuario: DIGITAL 999.498748 → 998.498748; COIN 103.980000 → 111.960000.

## Alcance y pendientes
- Estas observaciones muestran registro de operaciones y cambios visibles de saldo, **no** prueban todavía reintentos idempotentes bajo pérdida de red, seguridad de todas las funciones, ni respaldo de los activos.
- Verificar persistencia de saldos tras reinicio, recuperación de operaciones pendientes, reintento de la misma solicitud sin duplicación, y mensajes ante error de red.
- Revisar la lógica de cotización, tasas, redondeos y vencimiento. El simulador no usa precio de mercado ni respaldo real.
- No desinstalar APK anteriores hasta validar aceptación completa.
- No habilitar transferencias reales antes de proveedores regulados y requisitos legales.
