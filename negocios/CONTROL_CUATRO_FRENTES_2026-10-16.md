> **ACTUALIZACIÓN 17-10-2026:** primer corredor para **evaluación**, no para operación: **Estados Unidos→Honduras (US→HN)**. Nicaragua y los demás países permanecen en el catálogo global; ningún corredor está habilitado. Véase `negocios/DECISION_PILOTO_US_HONDURAS_2026-10-16.md`.

# Seguimiento ejecutivo — 4 frentes para el primer dólar real
Fecha: 2026-10-16. Estado: **ningún corredor habilitado**.

| Frente | Preparado | Bloqueo externo | Próxima evidencia válida | Responsable futuro |
|---|---|---|---|---|
| 1. Empresa | Expediente pre-LLC, brief comercial ES/EN | Elegir estado, constituir entidad, EIN, cuenta empresarial | Documentos registrados y asesoría fiscal/jurídica | Fundador + profesional legal/fiscal |
| 2. Socio regulado | RFI, shortlist de 3 candidatos, cartas ES/EN | Contacto comercial, elegibilidad US→HN, convenio, sandbox | Respuesta firmada/documentación oficial por corredor | Fundador + proveedor |
| 3. Cumplimiento | Lista de requisitos KYB/KYC/AML/OFAC y consumidores | Opinión legal US + HN, roles, políticas y auditoría | Dictámenes, matriz de responsabilidades y aprobaciones | Asesores + responsable de compliance |
| 4. Conexión técnica | App demo, mock de proveedor, pruebas CI, código de referencia ficticio | API auténtica, secretos servidor, ledger, conciliación y seguridad | Sandbox oficial con pruebas integrales y evidencia de controles | Ingeniería + socio regulado |

## Criterios de no avance
- No activar `realPaymentsEnabled`, `real_money` u otras variables por cambio visual: las autorizaciones no nacen del código.
- No emitir referencia redimible sin proveedor, identidad comprobada, fondos confirmados y aprobación de ruta.
- No marcar fondos de clientes como ingresos; conciliar con bancos y operadores.
- No almacenar documentación de identidad, contraseñas, claves API ni cuentas bancarias en GitHub.
- Una respuesta comercial genérica o cuenta sandbox no prueba cobertura Honduras ni autorización para operar desde EE. UU.
- No asumir que LLC, registro MSB o patrocinio individual reemplazan todas las licencias/obligaciones.

## Secuencia
1. Completar datos empresariales y obtener respuesta inicial de proveedores.
2. Resolver alcance US→HN: si no está permitido, evaluar corredor alternativo con igual arquitectura.
3. Acordar cumplimiento, contratos y responsabilidades de fondeo, pagos y servicio al cliente.
4. Obtener acceso al sandbox oficial y conectar **backend separado** por API real documentada.
5. Aceptación mediante conciliación, ledger, idempotencia, cifrado, verificación KYC/AML, redención única, reembolsos y auditoría.
6. Sólo después: piloto controlado con autorizaciones jurídicas, operativas y financieras escritas.

## Material listo en el repositorio
- `negocios/EXPEDIENTE_COMERCIAL_PROVEEDORES_2026-10-16.md`
- `negocios/PARTNER_OUTREACH_BRIEF_EN_2026-10-16.md`
- `negocios/CARTAS_ACERCAMIENTO_ES_EN_2026-10-16.md`
- `PLAN_INTEGRACION_PROVEEDOR_REGULADO_2026-10-16.md`

**Estado real:** material preparado, cero contactos enviados y cero proveedores contratados.

## Avance adicional de preparación empresarial
- Revisado 16-oct-2026: `negocios/PLAN_CONSTITUCION_CUMPLIMIENTO_2026-10-16.md` incorpora secuencia de constitución, EIN, privacidad, asesoría US→HN y cambio legal federal BOI 2026.
- Estado, tipo de entidad, firma, EIN y cuenta corporativa: **pendientes**; no registrar sin decisión empresarial ni asesoría.
- Entidad estadounidense normalmente exenta del reporte federal BOI conforme a regla FinCEN de agosto 2026; entidades extranjeras y obligaciones bancarias KYB requieren evaluación separada. La exención BOI no significa licencia financiera.
