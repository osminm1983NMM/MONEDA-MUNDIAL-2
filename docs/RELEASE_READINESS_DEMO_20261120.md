# Moneda Mundial 2.0 — puertas de salida (DEMO)

Estado: **NO APROBADO para dinero real**. Esta lista no equivale a resultados de pruebas. La rama principal no se modifica.

## Comprobaciones automatizables sin infraestructura de pago

- [ ] Ejecutar `node scripts/audit-demo-static.cjs` y guardar resultado de CI.
- [ ] Revisar que los flujos de transferencia y aportación usan `p_request_id` y que la RPC devuelve `ok` o `already_processed`.
- [ ] Revisar que el saldo e historial pertenecen al usuario autenticado y que los datos de una sesión anterior no se muestran al cambiar de cuenta.
- [ ] Verificar que ninguna clave de servicio Supabase ni secreto privado se entrega a Android.
- [ ] Validar que la APK proviene del commit auditado y que se instala y abre en dispositivo/emulador Android.

## Pruebas integradas pendientes — solo entorno de demostración

| Caso | Acción | Criterio de aceptación |
| --- | --- | --- |
| Transferencia normal | A envía 10.00 MWD a B | A -1000 centavos, B +1000; una operación contable |
| Reintento tras timeout | Repetir la misma solicitud con el mismo ID | Sin segundo débito; respuesta idempotente |
| Dos solicitudes simultáneas | Intentar gastar el mismo saldo dos veces | Sin saldo negativo ni doble gasto |
| Saldo insuficiente | Intentar transferir más del saldo disponible | Rechazo sin mutación |
| Acceso entre cuentas | A intenta leer saldo/operaciones privadas de B | RLS/RPC impiden lectura no autorizada |
| Cambio de sesión | Salir de A y entrar a B con actualización pendiente | Nunca mostrar datos de A en B |
| Fallo al refrescar | Confirmar operación y simular fallo de lectura posterior | Mostrar operación confirmada; no invitar a reenviar |
| Conversión Coin/Digital | Cotizar y confirmar, luego repetir confirmación | Una conversión, importes exactos y sin duplicación |
| Retiro ficticio | Crear retiro, perder conexión y reintentar | Una orden por ID; historial coherente |
| Android | Instalar APK verificada y abrirla | Sin cierre inesperado; navegación y sincronización funcional |

## Requisitos antes de cualquier lanzamiento real

- [ ] Revisión jurídica de licencias, modelo de socio regulado, BSA/AML, KYC, sanciones y protección al consumidor para EE. UU. → Honduras.
- [ ] Conciliación bancaria y contabilidad de doble partida con pruebas independientes.
- [ ] Gestión de fraude, límites, reversos, reclamaciones, monitoreo y auditoría.
- [ ] Revisión separada de custodia, reservas, emisión y regulación aplicable a activos digitales.
- [ ] Pruebas de penetración, recuperación, monitoreo y plan de incidentes.

**Regla de costos:** no iniciar ramas de base de datos de pago, builds en la nube ni servicios persistentes para completar esta matriz. Registrar evidencia antes de marcar cada casilla.
