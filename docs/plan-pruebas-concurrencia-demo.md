# Pruebas de concurrencia — Moneda Mundial DEMO

Objetivo: comprobar idempotencia, aislamiento y conservación de saldos sin tocar cuentas reales ni saldos de prueba existentes.

## Requisitos previos
- Usar exclusivamente un entorno aislado con cuentas y saldos ficticios recién creados.
- Registrar saldo inicial de cada cuenta, ID de solicitud, respuesta, asiento y saldo final.
- Nunca usar claves de servicio en el cliente ni activar pagos reales.

## Casos mínimos
1. **Transferencia duplicada:** lanzar dos solicitudes concurrentes con el mismo request_id y mismo importe. Esperado: un solo débito, un solo crédito y una operación.
2. **Reutilización conflictiva:** repetir request_id con importe o destinatario diferente. Esperado: rechazo sin nuevo movimiento.
3. **Fondos insuficientes:** lanzar dos transferencias distintas que individualmente caben, pero juntas superan el saldo. Esperado: como máximo una aceptada y saldo no negativo.
4. **Transferencias cruzadas A↔B:** ejecutar simultáneamente, vigilar interbloqueos y verificar suma de saldos constante.
5. **Pago comercial duplicado:** dos intentos de pagar la misma solicitud. Esperado: exactamente una transferencia y estado paid.
6. **Pago frente a cancelación:** ejecutar ambas acciones simultáneamente. Esperado: un solo estado terminal y, si cancelled, ningún débito.
7. **Conversión repetida:** confirmar dos veces la misma cotización. Esperado: una conversión y cuatro asientos balanceados.
8. **Cotización vencida:** rechazar sin modificar balances.
9. **Permisos:** usuario B no debe leer saldo, operaciones privadas ni cotizaciones de A; no propietario no puede usar RPC de propietario.
10. **Remesa ficticia:** dos transiciones con el mismo request_id no generan eventos duplicados; estados inválidos se rechazan.

## Criterios de aprobación
- 0 saldos negativos.
- 0 operaciones duplicadas por identificador.
- 0 conversiones sin asiento equilibrado por activo.
- 0 solicitudes canceladas con transferencia asociada.
- 0 accesos no autorizados.
- No se modifican datos del entorno principal.

Estado: PLAN DOCUMENTADO; pruebas concurrentes todavía NO ejecutadas.
