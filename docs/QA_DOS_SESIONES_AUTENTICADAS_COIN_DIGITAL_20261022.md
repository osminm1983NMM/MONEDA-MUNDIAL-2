# Prueba Coin ↔ Digital con cuentas autenticadas A y B (solo DEMO)
Fecha: 22 de octubre de 2026. No usar fondos, datos bancarios ni claves reales.

## Qué está preparado
- `src/digital-money/demo-two-account-verification.mjs` valida una sesión con `auth.getUser()`, aislamiento de seis tablas RLS, y lectura de la RPC de saldos de COIN/STABLE con historial. Proporciona las fases `prepareA`, `finishA`, `prepareB`, `finishB`, `verifyA`.
- **Actualmente el módulo no tiene pantalla integrada ni se ejecutó en teléfonos**. Las pruebas con dobles de cliente (mocks) no demuestran autenticación real por API.
- El flujo exige una conversión NUEVA en cada cuenta, diferencia de saldos coherente, ausencia de conversiones de A en B y viceversa, y saldo de A sin cambios tras la operación de B.

## Pasos para integrar y verificar en una futura build Android
1. Instalar una APK DEMO que incluya el flujo guiado; **la APK del 22 oct, run 39790623480, NO contiene este módulo nuevo**.
2. Iniciar sesión en cuenta de ensayo A y verificar «Seguridad» → «Comprobar mi cuenta». No compartir correos/contraseñas/JWT.
3. Invocar `prepareA` en la misma sesión y guardar el estado **únicamente en memoria**. Manualmente cotizar y confirmar COIN → Digital para A en la pantalla Conversión; comprobar recibo y ejecutar `finishA`.
4. Cerrar sesión A. Abrir cuenta distinta B en el mismo teléfono. Ejecutar `prepareB` y comprobar que no muestra la conversión de A.
5. Manualmente cotizar y confirmar Digital → COIN para B; ejecutar `finishB`. No repetir confirmaciones en caso de conexión incierta.
6. Cerrar B, abrir A y ejecutar `verifyA`. Solo marcar PASS si los cinco pasos y las comparaciones pasan.
7. Registrar únicamente PASS/FAIL por etapa y número de versión, nunca token, correo, códigos de retiro ni capturas con información personal.

## Límites actuales
- Comparar IDs de historiales bajo sesiones legítimas no prueba todas las RPC privilegiadas ni resistencia a ataques.
- Si hay más de veinte operaciones en el historial, la verificación puede requerir paginación adicional; fallar cerrado.
- Una app cerrada o recargada pierde el progreso en RAM. Repetir desde A.
- No se activan transferencias reales, emisión de criptomonedas, inversiones ni retiros bancarios.
