# Moneda Mundial 2.0 — Plan de validación de operaciones y acceso
**2026-10-15 · Entorno:** demostración; solo créditos ficticios MWD.

## Revisión realizada (solo lectura)
Se inspeccionaron las funciones servidoras `mwd_transfer_demo`, `mwd_contribute_demo`, `mwd_pay_merchant_demo`, `mwd_cancel_payment_request_demo` y sus restricciones SQL.

- `mwd_operations` tiene **UNIQUE(actor_id, request_id)** para impedir duplicación de operaciones por identificador de solicitud.
- `mwd_transfer_demo` bloquea ambas billeteras con `FOR UPDATE` en orden de usuario, compara el identificador anterior y devuelve `already_processed` al repetirse con parámetros idénticos; exige `auth.uid()`, límites de importes, fondos suficientes y prohíbe transferencias a la propia cuenta.
- `mwd_contribute_demo` bloquea billetera y comprueba idempotencia; exige `auth.uid()` y fondos ficticios suficientes.
- `mwd_pay_merchant_demo` bloquea la solicitud con `FOR UPDATE`; rechaza pagar el comercio propio, pagos con moneda distinta de MWD o solicitudes no pendientes. Usa `mwd_transfer_demo` para contabilizar el cobro y actualiza el estado a `paid`.
- `mwd_cancel_payment_request_demo` bloquea la solicitud; exige que `merchant_user_id` coincida con `auth.uid()`. No deja cancelar solicitudes pagadas.
- RLS está habilitado en `mwd_wallets`, `mwd_operations`, `mwd_payment_requests`, `mwd_merchants` y `mwd_admin_roles`; se inspeccionaron sus políticas nominales.
- Las RPC examinadas exigen autenticación (rol anónimo sin permiso de ejecución); las dos de administración comprueban el rol propietario dentro de la función.

**Resultados de lectura:** 4 billeteras; 0 claves idempotentes duplicadas; 0 pagos marcados como pagados sin transferencia correspondiente; 0 solicitudes canceladas con transferencia asociada; 0 saldos fuera de límites; 0 discrepancias entre saldo y movimientos al recalcular con el capital inicial ficticio de 10,000 MWD por cuenta. Las 4 billeteras suman 39,979.00 MWD de prueba.

## Próximas pruebas manuales de integración (NO ejecutadas aún)
Realizarlas con **dos cuentas de ensayo autorizadas, A y B**. No reutilizar contraseñas de uso personal, no revelar tokens y no publicar identificadores que permitan correlacionar cuentas privadas.

| Caso | Acción | Resultado esperado |
|---|---|---|
| T-01 | A transfiere 1 MWD a B | Débito A / crédito B una sola vez |
| T-02 | Repetir exactamente la misma solicitud con el mismo UUID, sin crear una nueva operación | Devuelve `already_processed`; cero débitos adicionales |
| T-03 | Reutilizar ese UUID con distinto importe/destinatario | Rechazo por identificador ya utilizado |
| T-04 | A intenta enviarse a su propia billetera | Rechazo y cero saldo alterado |
| T-05 | A intenta enviar cantidad superior al saldo | Rechazo y cero saldo alterado |
| P-01 | A crea solicitud de cobro ficticio de 2 MWD; B paga | La solicitud queda `paid` y se registra una sola transferencia |
| P-02 | Repetir pago de P-01 desde B | `already_processed` sin segunda transferencia |
| P-03 | A intenta cancelar P-01 ya pagado | Rechazo |
| P-04 | A crea nueva solicitud y la cancela; B intenta pagarla | Rechazo y cero transferencia |
| P-05 | B intenta cancelar solicitud de A | Rechazo por no ser titular |
| R-01 | B consulta datos de billetera privada de A | Sin acceso directo; RLS |
| R-02 | B consulta resumen/tarifas privadas de propietario | RPC deniega acceso si B no es propietario |
| S-01 | Cerrar A e iniciar B mientras hay consultas pendientes | Ningún saldo, comercio o resultado privado antiguo debe reaparecer |

**Importante:** la UI actual genera nuevos UUID por operación; las pruebas T-02/T-03 requieren un cliente de prueba autenticado diseñado para reutilizar exactamente el identificador. No intentar fingir esta prueba pulsando el botón dos veces; eso podría crear operaciones distintas. Nunca probar en dinero real.

## Auditoría repetible
Ejecutar `scripts/AUDITAR_INTEGRIDAD_PAGOS_DEMO_READONLY.sql` después de cada prueba. Las consultas no realizan escrituras.

## Riesgos que permanecen
- La lectura de funciones, restricciones y políticas no sustituye una prueba real de concurrencia ni una auditoría externa.
- La primera versión de la APK en Samsung ha sido verificada visualmente; la versión más reciente sigue bajo compilación y necesita pruebas manuales.
- Antes de cualquier producto financiero real faltan licencias o acuerdos con socios autorizados, custodia regulada, BSA/AML/KYC/OFAC, gestión de fraude, contabilidad de doble entrada, auditoría y cumplimiento por jurisdicción.
