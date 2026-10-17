# Moneda Mundial 2.0 — ruta ejecutable al primer dólar REAL
Fecha: 2026-10-16. Actualizado: 2026-10-17. Estado: **plan de lanzamiento y control; NO habilitado**.

## Objetivo comercial inequívoco
No terminar en una simulación. El producto final debe aceptar fondos reales, transferirlos y pagar al beneficiario a través de contrapartes autorizadas, con registros bancarios conciliados, derechos del consumidor, transparencia de tarifas y protección contra fraude. Los saldos MWD de demostración NUNCA serán fondos reales ni convertibles.

Nicaragua y todos los otros países se mantienen en el catálogo de diseño y podrán evaluarse por corredor, sin habilitar dinero real automáticamente.

## Primera ruta de evaluación
Evaluar un piloto **Estados Unidos (USD) → Honduras (HNL/USD según posibilidad legal y bancaria)** de envío a cuenta y retiro en efectivo sin aplicación del beneficiario. Esto no implica que Honduras esté autorizado, contratado o habilitado. Si la evaluación legal/comercial no lo permite, escoger una ruta viable sin deshacer la arquitectura internacional.

## Condiciones previas para aceptar el primer dólar
1. Entidad jurídica establecida, identidad de beneficiarios finales, cuenta de empresa y obligaciones fiscales identificadas.
2. Abogados especializados confirman por escrito el modelo: quién es transmisor/registrante MSB, quién obtiene licencias estatales si aplican, quién tiene contrato con entidad regulada; jurisdicción de origen Y destino.
3. Institución regulada para fondos del remitente, custodia, reembolsos, pago bancario y/o red de agentes, contratos y acuerdos de servicio. No utilizar cuenta personal.
4. Proveedor KYC/KYB y AML con control de sanciones, monitoreo, alertas y reportes; proceso específico para verificar físicamente al receptor sin teléfono.
5. Reglas de divulgación de remesas según aplicabilidad: tasas, comisiones, cantidad final, tiempo, recibos, errores, cancelación y reembolsos.
6. Plataforma backend aislada de demo: secretos únicamente del servidor, acceso administrativo MFA, roles de agente de menor privilegio, auditoría inmutable, doble aprobación de actividades sensibles.
7. Libro mayor de partida doble para saldos reales, conciliación de banco/procesador y gestión de reversos/contracargos; no dar por liquidados pagos antes de confirmación verificable.
8. Proveedor con sandbox verificable: ensayar webhooks firmados, pagos duplicados, fondos insuficientes, códigos vencidos, errores de FX, caídas y reembolsos.
9. Evaluación independiente de seguridad, privacidad, copias de seguridad y respuesta a incidentes; pruebas manuales móviles.
10. Firma y aprobación de riesgo, operaciones, legal y socio financiero para CADA corredor. Activar sólo desde backend separado, nunca editando una variable en Android.

## Flujo real previsto
Remitente identificado → verificación KYC/sanciones/límites → cotización vigente → consentimiento y divulgaciones → orden idempotente → captación confirmada por proveedor → asiento contable → instrucción de remesa regulada → confirmación de pago al beneficiario o reverso → conciliación diaria → recibo, derechos de errores y reembolso.

Para retiro sin teléfono: el proveedor pagador autorizado verifica identidad presencial y elegibilidad; código secreto de un solo uso, con límites de intentos y vencimiento, comprobación ONLINE del servidor y consumo atómico. Nunca basta únicamente con portar el código. Un dispositivo sin conexión no puede validar libremente fondos.

## Primer entregable a solicitar a futuros socios
- Modelo contractual de patrocinio/servicios de remesas y cobertura geográfica.
- Métodos de fondeo (banco, tarjeta), disponibilidad para el país y moneda elegidos.
- API de sandbox y webhooks verificables; idempotencia, reembolsos y conciliación.
- Procedimiento presencial de verificación e identidad para retiros sin app.
- Esquema de tarifas totales y margen de contribución por corredor.
- Responsabilidades de KYC/AML, sanciones, declaraciones, soporte, custodia y disputas.

## Progreso técnico real al 16 oct 2026
- Demo: UI Android, base Supabase, remesas y códigos ficticios.
- Estudio de arquitectura y guardia técnica agregada: src/real-money-launch-gates.mjs (sólo evaluación documental; todas las salidas monetarias reales retornan false).
- PENDIENTES: contratación, licencia/estructura adecuada, compliance, infraestructura bancaria real, billetera regulada, sandbox del proveedor, despliegue verificado y aprobación.
- No mover flags `real_payments_enabled`, no crear saldo real en `public.mwd_wallets`, no depositar dinero a cuentas de prueba.

## Verificaciones regulatorias de referencia
- FinCEN money services businesses: https://www.fincen.gov/money-services-businesses-msbs
- CFPB Reglamento E, Subparte B remesas: https://www.consumerfinance.gov/rules-policy/regulations/1005/
- OFAC cumplimiento sanciones: https://ofac.treasury.gov/
- CSBS y NMLS para licencias de transmisores de dinero: https://www.csbs.org/
- Regulador y normas del país de destino: requerir confirmación escrita específica antes de habilitarlo.

**Este es un plan técnico y empresarial, no un dictamen jurídico ni una licencia.**
