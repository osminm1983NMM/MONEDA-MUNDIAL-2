# Matriz de pruebas de concurrencia de pagos ficticios (sin ejecutar)

Fecha: 2026-11-16. Basada en lectura de las definiciones SQL de mwd_owner_assign_payout_design_demo y mwd_owner_cancel_pickup_code_demo, además de las funciones de emisión, consumo y cierre revisadas previamente.

## Precondiciones

Laboratorio aislado con autorización expresa para escrituras y cualquier costo; dos sesiones autenticadas del propietario y una cuenta sin rol owner. Crear órdenes y socios ficticios exclusivamente en ese laboratorio. Registrar instantáneas de tablas antes y después. No usar saldos reales ni de la DEMO existente.

## Escenarios y resultados esperados

| Caso | Solicitudes simultáneas | Resultado esperado |
|---|---|---|
| A1 | Dos asignaciones con distinto request_id para la misma orden en review | Una asignación y un evento assigned; la otra rechazada |
| A2 | Dos asignaciones con el mismo request_id y mismos datos | Una asignación; segundo resultado already_processed |
| A3 | Reusar request_id de asignación con otra sucursal | Rechazo sin segunda asignación |
| C1 | Dos cancelaciones del mismo código activo | Un evento cancelled; segundo already_processed |
| C2 | Cancelación y validación correcta del mismo código | Solo un estado terminal (cancelled o consumed); nunca ambos eventos terminales |
| C3 | Cancelación de código vencido | Estado expired y un evento expired |
| V1 | Dos validaciones correctas del mismo código con distintos request_id | Un único consumo y evento consumed |
| V2 | Reintentar validación con mismo request_id pero código diferente | Rechazo de clave reutilizada |
| V3 | Cinco códigos erróneos concurrentes | failed_attempts máximo 5 y estado locked; verificar número de eventos wrong_code |
| P1 | Dos cierres sample_completed simultáneos | Una transición y un evento sample_completed |
| P2 | Reintentar cierre con mismo request_id | already_processed sin segundo evento |
| S1 | Invocar funciones con sesión sin rol owner | Acceso denegado y ningún cambio |

## Observaciones sobre código inspeccionado

La asignación bloquea la fila orders con FOR UPDATE, comprueba una asignación previa, y la restricción UNIQUE(order_id) protege la tabla. La cancelación bloquea la fila pickup_code_samples con FOR UPDATE OF c y devuelve already_processed cuando ya está cancelled. El código de validación bloquea la misma fila del código, lo que debería serializar cancelación/consumo. Estas son expectativas para comprobar, no resultados medidos.

## Criterios de aceptación

- Cada escenario produce el estado final previsto y ningún saldo MWD cambia.
- Los eventos terminales de cada código son consistentes con su estado final.
- La misma referencia de reintento no produce una segunda operación.
- El rol no autorizado no puede leer ni escribir por estas funciones.
- Repetir auditoría database/auditoria_eventos_codigos_pagos_demo_solo_lectura.sql después de las pruebas.

**Estado:** pendiente de ejecutar; este archivo no inicia operaciones ni incurre costos.
