# Tercera modalidad propuesta: retiro de efectivo con referencia

## Objetivo
Permitir en el futuro enviar remesas desde Estados Unidos a un beneficiario en Nicaragua
que no dispone de teléfono, cuenta bancaria ni aplicación Moneda Mundial.
Como referencias de experiencia de cliente: Western Union y Remitly;
no existe asociación comercial con esas marcas.

## Alcance implementado ahora (solo DEMO local)
Pantalla «Retiro de efectivo con código (demostración)» en la app.
El usuario elige un importe de ejemplo de 1 a 100,000 USD y puede generar
un código hexadecimal con prefijo **DEMO-NI-** usando 96 bits aleatorios
del generador criptográfico de Android. El código:
- NO es una remesa, contraseña bancaria ni orden de pago.
- NO queda registrado en Supabase y no puede validarse por un tercero.
- NO representa fondos, saldo, tasa de cambio, comisión ni monto entregable.
- NO cambia billeteras, historiales ni datos del propietario.
- NO solicita documentos de identidad, teléfono ni datos del receptor.
- Muestra «NO VÁLIDO PARA COBRAR» de forma visible.
- No aparece ninguna opción para «retirar», «autorizar» ni enviar dinero real.

## Diseño de producción futuro (sin activar)
1. Acuerdos y contratos con transmisor de dinero y agentes pagadores debidamente autorizados
   en cada jurisdicción, incluidos controles para Nicaragua y estados de EE. UU.
2. Capturar datos mínimos necesarios de beneficiario y pagador de forma segura,
   cifrada y con retención conforme a ley. No incluir números de documento
   en un comprobante compartible ni usar solo un código como identificación.
3. Antes de emitir una referencia válida: aceptación regulatoria de la transacción,
   fuente de fondos aprobada y confirmación inequívoca del proveedor.
4. Referencia opaca de alta entropía asociada a registro protegido en backend
   y validada por el pagador autorizado (nunca confiar solamente en el papel).
5. Estados registrados: pendiente_de_financiación, financiado, disponible,
   pagado, cancelado, vencido y bloqueado; límites, caducidad, revocación,
   control antifraude e idempotencia bajo transacciones atómicas.
6. El agente verifica identidad, coincidencia de nombre, alertas AML/sanciones,
   límites y fondos. Control de cobro único con bloqueo transaccional.
7. Devoluciones, atención de reclamaciones, comprobantes, protección del
   consumidor, reconciliación del proveedor y auditoría inmutable.
8. Definir y divulgar antes de aceptar dinero: comisión, tipo de cambio, moneda
   de entrega, cantidad a recibir, ventanas de retiro y política de cancelación.
9. Si se habilita, abrir por corredor-país/agente de manera explícita;
   no dar a entender que todo banco de Nicaragua aceptará referencias MWD.

## Pruebas
`tests/cash-pickup-demo.test.mjs` verifica que la referencia de muestra
no sea cobrable, no invente un tipo de cambio ni requiera información de identidad.
No sustituye integraciones con socios financieros ni asesoría legal.
