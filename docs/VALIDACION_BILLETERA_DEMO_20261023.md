# Billetera MWD — validación al actualizar saldo (DEMO, 23 octubre 2026)

### Objetivo
Evitar que un saldo/historial malformado o que pertenece a otra cuenta se muestre como saldo disponible; impedir que una respuesta de actualización antigua sobrescriba datos más recientes.

### Cambios propuestos
- \`src/demo-wallet-refresh-safety.mjs\`: valida que \`mwd_wallets.user_id\` corresponda al usuario solicitado, el código tenga formato MWD, el saldo sea entero no negativo, y las entradas de historial pertenezcan a esa cuenta y tengan referencias, fechas e importes correctos. Sanitiza la representación utilizada por la interfaz.
- \`isCurrentDemoWalletRefresh\`: exige identidad activa coincidente, mismo epoch de sesión y última secuencia de petición.
- \`App.js\` usa este contrato antes de publicar saldo e historial. Al comenzar un nuevo refresco, oculta temporalmente ambos para no permitir operar tomando como base cifras obsoletas; al fallar validación no muestra saldo ni historial previo.
- El estado de propietario sólo muestra las opciones de DEMO y no concede autorización real.
- Suite de pruebas Node sobre cuentas A/B, saldos negativos o falsificados, duplicación de movimientos, actualización obsoleta y balance cero.

### Lo que NO garantiza
No compara contra un libro mayor bancario, no certifica que el saldo del servidor sea correcto, no aplica KYC/AML, no revisa transacciones reales, no autoriza pagos, no almacena dinero. La protección de RLS y funciones RPC del servidor sigue pendiente de una auditoría independiente; una validación en la app jamás sustituye autorización del backend. El sistema sigue \`REAL_PAYMENTS_ENABLED=false\`.

Revisión requerida: CI, pruebas de cuentas autenticadas A/B y APK Samsung, especialmente actualizaciones simultáneas y cambio de sesión. No fusionar sin revisión.
