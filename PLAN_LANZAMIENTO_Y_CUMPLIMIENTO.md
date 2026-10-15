# MONEDA MUNDIAL 2.0 — Ruta hacia una plataforma internacional
Actualización: 2026-10-15

## Principio fundamental
Actualmente **solo es un prototipo que mueve créditos ficticios**. No hay bancos conectados, depósitos, retiros, transferencias monetarias, tipos de cambio en tiempo real ni licencias confirmadas. Ningún despliegue activa dinero real automáticamente.

## Estado técnico comprobado
- GitHub: `osminm1983NMM/MONEDA-MUNDIAL-2`; rama principal `main`. Esta rama de desarrollo requiere validación y revisión antes de fusionar.
- Supabase `egrsdrlpavrtbgxoyxvg`: proyecto activo; autenticación, billeteras, operaciones y roles de prueba con RLS.
- En Supabase existen 249 países de catálogo; **todos** marcados `not_available` para pagos reales. El simulador tiene 19 rutas de prueba con origen US. Los países de simulación no son países habilitados para enviar dinero.
- API de prueba: `mwd_world_countries_demo`, `mwd_quote_international_demo`, `mwd_owner_summary_demo`, `mwd_history_demo`, `mwd_pay_merchant_demo`.
- El App.js de esta rama añade pantallas para consulta del catálogo, simulaciones, comercio, pagos ficticios y resumen administrativo limitado al propietario. No probado aún en dispositivo.

## Prioridades por fase (y criterios de aprobación)

### A. Calidad del producto
1. Revisar errores de aplicación Android/Expo, diseño responsive, accesibilidad, estados de carga y errores en red.
2. Pruebas con dos usuarios separados: cuenta, transferencia, saldo, historial; solicitudes de cobro, pago, cancelación e intentos repetidos.
3. Revisar comportamiento concurrente e idempotencia. Integrar CI, pruebas automáticas, reporte de vulnerabilidades y control de versiones.
4. Publicar una **APK solo de prueba** después de pasar las verificaciones. Mantener visible el aviso de demostración.

### B. Seguridad y datos
1. Auditar todas las políticas RLS y funciones `SECURITY DEFINER`: cada RPC necesita comprobación explícita de identidad, permiso y límites; una advertencia automatizada por sí sola no prueba vulnerabilidad.
2. Activar protección contra contraseñas filtradas y MFA para roles de administración cuando el plan/entorno lo permita.
3. Diseñar seguridad de servidor, auditoría, gestión de secretos, controles de abuso, bloqueo por riesgo, registro de incidentes y recuperación ante desastres.
4. Separar entornos demo, staging y producción con secretos, proyectos, datos y roles independientes. **No reutilizar saldos de prueba como dinero real**.
5. Libro mayor de doble entrada, asientos inmutables, reconciliación, liquidación, devoluciones, reversos, comisiones, reservas y segregación de fondos *antes* de pagos reales.

### C. Modelo de negocio y despliegue legal
1. Definir entidad comercial, jurisdicción, beneficiarios y estructura de propiedad con abogado y asesor contable.
2. Establecer modelo exacto: transmisor de dinero propio o proveedor licenciado de banking-as-a-service/remesas como principal regulado y Moneda Mundial como agente/partner autorizado cuando proceda.
3. Evaluar obligación de registro como MSB con FinCEN y requisitos de licencia/transmisor para **cada estado aplicable** de EE.UU. Registro federal no equivale a licencia estatal. Solicitudes suelen gestionarse a través de NMLS.
4. Preparar programa BSA/AML, designación de responsable, identificación/verificación de clientes (KYC/CIP según aplique), sanciones OFAC, monitoreo, SAR/CTR cuando correspondan, privacidad, ciberseguridad y retención.
5. Evaluar obligaciones del CFPB / Regulation E de remesas: información sobre tasas, montos, tarifas, cancelaciones y resolución de errores.
6. Cada corredor destino requiere estudio específico de leyes locales, socio de desembolso, bancos/tarjetas, impuestos, protección de consumidores y autorización para actividades concretas.
7. Obtener acuerdos, seguros/fianzas, informes y aprobaciones necesarios **antes** de procesar dinero real. Esta lista no constituye licencia ni asesoría legal.

### D. Producto financiero real: dependencias
1. Identificar banco patrocinador y proveedor de transferencias/remesas regulado; evaluar contratos, precios, países atendidos, SLA, cumplimiento, custodia/segregación.
2. Arquitectura para onboarding de identidad, ingreso de fondos, envío, recepción, retiros, reembolsos y soporte.
3. Tipo de cambio de proveedor con vigencia y transparencia; no simular un monto receptor real cuando no existe fuente de FX.
4. Pruebas con sandbox del proveedor, auditorías independientes y piloto restringido en corredores aprobados.
5. Solo habilitar países y métodos con validación regulatoria y operativa explícita y documentada; `realPaymentsEnabled=false` por defecto.

## Decisiones pendientes del propietario
- País/estado de constitución, nombre legal y beneficiarios.
- Corredor inicial deseado y orden de expansión (por ejemplo EE.UU. → Costa Rica / Honduras, sujeto a evaluación).
- Modelo con socio licenciado versus licencias propias; presupuesto y abogados de compliance.
- Cuenta empresarial, banca/proveedor, contratos y documentación requerida.
- Aprobación del diseño y de la APK demo tras pruebas.

## Referencias regulatorias iniciales oficiales
- FinCEN MSB: https://www.fincen.gov/money-services-business-msb-registration
- CFPB Regla de Remesas: https://www.consumerfinance.gov/compliance/compliance-resources/deposit-accounts-resources/remittance-transfer-rule/
- NMLS: https://mortgage.nationwidelicensingsystem.org/
- Supervisión de transmisores de dinero en Maryland: https://www.dllr.state.md.us/finance/industry/moneytran.shtml

> Este documento organiza trabajo técnico y diligencia legal. Ninguna etapa garantiza autorización de las autoridades.
