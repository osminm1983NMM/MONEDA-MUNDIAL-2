# Prueba de recuperación tras pérdida de respuesta — remesas DEMO

Fecha: 2026-11-16. Revisión de RemittanceDemoScreen.js y definición SQL de public.mwd_owner_remittance_transition_demo. Plan sin ejecución de escrituras.

## Evidencia inspeccionada

- El cliente guarda pendingTransition.current con orderId, siguiente estado y requestId antes de llamar al RPC; si falla la llamada conserva la referencia y ofrece «Reintentar cambio pendiente».
- El servidor ejecuta assert_owner(), bloquea orders con SELECT ... FOR UPDATE, busca un evento anterior por order_id y request_id y devuelve already_processed=true cuando el destino coincide.
- Si el requestId anterior existe con otro destino, el servidor rechaza la operación.
- Si el cambio es nuevo, solo permite draft→review/cancelled o review→simulated/cancelled; actualiza orders e inserta events dentro de la misma transacción.
- El cliente exige real_payments_enabled=false y redeemable=false antes de aceptar la respuesta.

## Escenarios a ejecutar en laboratorio aislado

1. Solicitud draft→review: dejar que el servidor confirme pero simular pérdida de respuesta HTTP. Reintentar con el mismo UUID: esperar already_processed=true y un único evento.
2. Repetir la misma transición con UUID diferente: esperar rechazo por transición inválida, sin nuevo evento.
3. Reutilizar UUID de transición con destino distinto: esperar rechazo y sin cambio de estado.
4. Dos solicitudes simultáneas draft→review con UUID diferentes: esperar una transición y un evento, con rechazo de la segunda.
5. Dos solicitudes simultáneas draft→review con el mismo UUID: esperar una transición y respuesta idempotente en la segunda.
6. Ejecutar con usuario autenticado sin rol owner: esperar rechazo y cero cambios.
7. Reiniciar la aplicación entre envío y respuesta: comprobar la recuperación manual desde historial. Advertencia: pendingTransition usa useRef y no sobrevive al reinicio; la aplicación no puede reintentar automáticamente con el UUID anterior después de cerrarse. No crear una nueva operación sin reconciliar el estado.

## Criterios de aceptación

Contar eventos y órdenes antes y después; verificar que los saldos MWD permanezcan idénticos; comprobar estados y UUID de cada respuesta. No utilizar datos reales ni entorno compartido. Cualquier ejecución con escrituras o costo requiere aprobación previa.

## Riesgo pendiente

El identificador de reintento se conserva solo en memoria durante la sesión de la pantalla. Una futura mejora puede persistirlo de forma segura y reconciliarlo al iniciar, pero debe diseñarse y probarse antes de introducirla.
