# Plan de privacidad y autorizacion de pagos DEMO

Estado: plan de pruebas; NO certifica seguridad ni habilita pagos reales.

## Alcance
- `public.mwd_get_payment_request_demo`: una solicitud `pending` puede consultarse por cualquier usuario autenticado que conozca su UUID; confirmar que esta decision es intencional y que solo expone campos publicables (`id`, `business_name`, `amount_cents`, `currency_code`, `status`, `description`). Evaluar si `description` puede contener datos sensibles. No usar datos personales en pruebas.
- `public.mwd_history_demo`: usuario A ve solo operaciones donde A es origen o destino; usuario C no ve operaciones A-B.
- `public.mwd_operation_status_demo`: solo el actor de una operacion puede recuperar su estado procesado; un tercero debe recibir `unconfirmed` sin datos de la operacion.
- `public.mwd_pending_recipient_check_demo`: revisar riesgo de enumeracion de codigos de cuenta y aplicar limites de frecuencia antes de operar con usuarios reales.
- `public.mwd_pay_merchant_demo`: verificar propiedad, importe inmutable, estados y repeticion concurrente.

## Casos aislados a ejecutar cuando exista entorno seguro
1. A crea solicitud pendiente de pago; B autenticado consulta UUID valido: recibe solo datos necesarios para pagar.
2. C intenta consultar solicitud no pendiente de A: debe fallar sin filtrar datos.
3. A/B/C comparan historiales: C no recibe datos de transferencias A-B.
4. C consulta `request_id` de A: no recibe importe, destinatario ni ID de operacion.
5. Dos llamadas simultaneas para pagar una solicitud: solo un cargo, un abono y un cambio de estado.
6. Reintentos y solicitudes inexistentes: respuestas coherentes, sin informacion privada.
7. Usuario no autenticado: funciones protegidas rechazan la operacion.

## Reglas
- No ejecutar escrituras en base principal; no usar saldos reales, tokens, credenciales ni datos de clientes.
- No activar pagos reales ni alterar permisos sin revision y autorizacion.
- Registrar resultados observados y fallos; no confundir lectura de codigo con pruebas de aislamiento real.
