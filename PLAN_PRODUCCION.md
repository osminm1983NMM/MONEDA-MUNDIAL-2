# Moneda Mundial 2.0 — plan de preparación para producción

Fecha: 2026-10-13

## Estado actual y separación estricta

- La app actual es un **prototipo de demostración**. El saldo MWD es ficticio, no convertible ni redimible por dinero real.
- La aplicación usa Supabase Auth y operaciones ficticias almacenadas mediante funciones RPC.
- Los pagos entre usuarios y comercios **no** transfieren dinero bancario ni criptoactivos reales.
- La rama de desarrollo debe pasar pruebas automáticas y pruebas manuales antes de integrarse en `main`.
- No se debe sustituir el saldo ficticio por un saldo real cambiando solo las etiquetas: requiere arquitectura contable y cumplimiento regulatorio separados.

## Controles técnicos obligatorios previos al lanzamiento real

1. **Autorización**: acceso mínimo, políticas RLS, auditoría de funciones `SECURITY DEFINER`, permisos explícitos y pruebas de acceso indebido entre usuarios.
2. **Autenticación**: defensa ante contraseñas comprometidas, MFA para administradores, reautenticación en operaciones sensibles, recuperación de cuentas y gestión de sesiones.
3. **Contabilidad**: libro mayor de partida doble, inmutabilidad auditable, integridad por transacción, conciliación automática, manejo de reversos y disputas; el esquema `mwd_finance_private` es preparación técnica y no constituye procesamiento real.
4. **Operaciones de pagos**: idempotencia por transacción, control de concurrencia, límites, revisión antifraude, estados definitivos verificables y alertas.
5. **Protección de datos**: cifrado en tránsito y reposo, gestión de secretos fuera del cliente, controles de acceso, copias de seguridad y plan de respuesta ante incidentes.
6. **Calidad**: pruebas unitarias y de integración; pruebas negativas de RLS, concurrencia, reintentos, fallos parciales, recuperación y compilación Android/iOS.
7. **Observabilidad**: trazas sin credenciales ni datos financieros sensibles, alertas, salud de servicios, respaldos y procedimientos de soporte.

## Requisitos empresariales, financieros y legales pendientes

- Definir jurisdicción de lanzamiento y constituir la entidad adecuada; **una LLC por sí sola no autoriza** servicios de transferencia de dinero.
- Consultar a especialistas legales de cada país para determinar licencias aplicables, registros, regulador, restricciones cambiarias y reglas fiscales.
- En Estados Unidos evaluar, según el modelo concreto, obligaciones FinCEN/MSB, licencias de transmisor de dinero estatales o uso de un socio regulado; no asumir que cualquiera de estas vías aplica automáticamente.
- Establecer políticas AML/KYC, detección de sanciones, monitoreo de operaciones, identificación del beneficiario y reportes exigibles.
- Elegir socio regulado de custodia, infraestructura de pago, verificación de identidad y manejo de reembolsos; realizar diligencia contractual.
- Definir quién custodia fondos, términos del usuario, comisiones, transparencia sobre divisas, protección al consumidor, privacidad y responsabilidad por fraude.
- Verificar necesidades de auditoría, impuestos, accesibilidad, publicación en tiendas y atención a clientes.
- Abrir **por fases**, comenzando por una sola jurisdicción, después de validaciones técnicas, legales y regulatorias documentadas.

## Advertencias de seguridad detectadas en Supabase

- El asesor reporta cinco funciones `SECURITY DEFINER` accesibles a usuarios autenticados. Su uso es deliberado en la demo para operaciones controladas, **pero exige pruebas y revisión específica del código y de permisos** antes de producción.
- La protección ante contraseñas filtradas aparece desactivada en Supabase Auth; debe activarse en la configuración si está disponible.
- Las tres tablas del registro contable privado muestran RLS sin políticas: se confirmó que los roles `anon` y `authenticated` **no tienen acceso directo de lectura**. Es aislamiento intencional; verificar también los otros privilegios antes de producción.

## Próximo criterio de aceptación

- CI completamente verde (pruebas y exportación Android).
- Dos usuarios de prueba pueden registrarse, transferir MWD ficticios, consultar movimientos y comprobar idempotencia sin doble débito.
- Dos usuarios de prueba pueden registrar un comercio, emitir una solicitud, pagar y cancelar sin privilegios cruzados.
- Funciones de datos sensibles revisadas, decisiones regulatorias documentadas y aprobación legal antes de conectar proveedores de fondos reales.

Ningún cambio técnico en esta rama habilita ni autoriza pagos con dinero real.
