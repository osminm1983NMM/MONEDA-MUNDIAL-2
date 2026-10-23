# Recuperación de transferencias interrumpidas — SOLO DEMO (23 oct 2026)

## Problema
Una solicitud puede crear una orden ficticia y perder la respuesta de confirmación por falla de internet. Reenviar sin comprobar podría crear otra orden. La respuesta adecuada es **conservar la referencia y consultar el resultado sin enviar otra operación**.

## Solución de laboratorio
\`createMockInterruptedTransferRecovery\` (servidor Node, sin Android todavía) utiliza sólo \`createMockInternationalTransferGuard\`, con dos métodos diferentes: \`submitMockTransfer\` se llama **una vez** y \`inspectMockTransfer\` consulta el estado de sólo lectura.

1. Comprueba que la cotización de demostración no haya vencido y corresponde al alias sintético de la sesión.
2. Registra en memoria una confirmación pendiente *antes* de llamar al transporte.
3. Si se obtiene un recibo verificable y la sesión no cambió, se registra como verificada.
4. Ante cualquier respuesta perdida, desconexión o dato inconsistente, **se mantiene bloqueado** un segundo envío con la misma cuenta en este controlador hasta comprobar el resultado.
5. \`inspectWithoutResubmitting()\` sólo hace una consulta. Si no hay resultado en el laboratorio o la red falla, no interpreta ausencia de recibo como ausencia de ejecución; conserva el bloqueo. Nunca vuelve a confirmar.
6. Al cambiar de cuenta o revisión de sesión, una respuesta tardía no limpia ni expone las operaciones de otra cuenta. Al volver a la cuenta original se puede consultar su referencia.
7. Una referencia ya verificada queda en una pequeña caché volátil para evitar otra llamada de envío con la misma cotización.

### Limitaciones
- **No hay persistencia.** Reiniciar el proceso pierde pendientes y caché: NO apto para clientes de producción ni garantiza evitar duplicados entre servidores, dispositivos o sesiones reales. Su protección es sólo para un proceso de laboratorio.
- El contexto de sesión son **alias sintéticos**, NO JWT ni identidades verificadas. Ningún cliente puede ser considerado autorizado por estos tests.
- No se conecta con Supabase, Android, bancos ni proveedores, ni mueve dinero real.
- Este módulo no arregla otras vías directas que llamen el guard fuera del controlador.
- Antes de fondos reales: idempotencia y bloqueo transaccionales en base de datos, ledger contable, autenticación y autorización real, reconciliación externa, política de incidentes, expiración/retención, investigación de estados inciertos y pruebas de concurrencia/dispositivos.

Pruebas: \`node --test tests/mock-interrupted-transfer-recovery.test.mjs\`.
CI: \`.github/workflows/test-mock-interrupted-transfer-recovery.yml\`. Mantener solicitud de cambios como borrador hasta revisión.
\`REAL_PAYMENTS_ENABLED=false\` permanece obligatorio.
