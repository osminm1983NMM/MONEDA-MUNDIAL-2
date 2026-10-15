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

## Arquitectura mundial: 249 países y territorios como destinos de DISEÑO
- Se reutiliza `mwd_world_countries_demo` para ofrecer los 249 códigos de
  catálogo ya presentes en Supabase, previa autenticación.
- La pantalla permite seleccionar cualquier código del catálogo e imprimir
  un ejemplo `DEMO-XX-...` no cobrable; el origen ficticio actual es US.
- El catálogo mundial se prepara para incorporar otros orígenes en producción
  mediante la combinación `origen ISO + destino ISO + moneda + socio + producto`;
  no basta listar países para ofrecer servicio.
- Ningún destino se habilita para cobro real al figurar en el catálogo.
  No se reutiliza `demoAvailable` (simulador de comisiones) como
  indicador de disponibilidad de retiro de efectivo.
- Para producción: catálogo versionado de corredores y socios pagadores,
  monedas, horarios, límites, identificación aplicable y bloqueos reguladores;
  disponibilidad por país, localización, agente y fecha.
- En nuevos mercados se exige un motor de elegibilidad servidor, no botones
  del móvil, e integración verificada con agente autorizado.
- Estados de referencia y libro mayor quedan en el servidor de pagos regulado;
  la APK nunca acredita pagos ni activa retirada por cambiar el destino.

**Estado comprobable:** alcance de diseño mundial incorporado; disponibilidad
comercial y acuerdos con bancos/agentes: ninguna.
