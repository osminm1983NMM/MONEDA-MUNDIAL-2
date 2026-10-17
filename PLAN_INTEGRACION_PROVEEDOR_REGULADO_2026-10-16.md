# Moneda Mundial 2.0 — integración con un proveedor financiero regulado
Fecha: 2026-10-16. Actualizado: 2026-10-17. Estado: **adaptador mock probado en CI; ningún proveedor contratado o conectado**.

**Ruta inicial prioritaria para evaluar: EE. UU.→Honduras.** Nicaragua y los demás países permanecen en el catálogo mundial; no se afirma servicio disponible para ninguno.

## Los cuatro frentes se ejecutan EN PARALELO
| Frente | Entregable verificable | Situación |
| --- | --- | --- |
| 1. Constitución | LLC/estructura elegida tras asesoría legal; registros y cuenta empresarial | Pendiente de constitución y asesoría |
| 2. Proveedor regulado | Diligencia comercial, contrato, cobertura US→HN y credenciales sandbox otorgadas oficialmente | Candidatos por evaluar; ningún contrato |
| 3. Cumplimiento normativo | Opinión jurídica por jurisdicción, responsabilidades FinCEN/estatales y país destino, KYC/AML, OFAC, consumidor | Pendiente |
| 4. Integración financiera | Adaptador de servidor, simulación con webhooks firmados, ledger real, conciliación, reembolsos, entorno sandbox externo y pruebas | Adaptador mock en GitHub; conexiones reales pendientes |

## Arquitectura ya preparada
- `src/server/mock-regulated-provider-bridge.mjs` es exclusivamente **servidor Node.js de prueba**, **no código para el móvil**. Sólo acepta `mode=mock`; modo `live` se rechaza.
- La cotización de muestra no inventa tipo de cambio, tarifa o cantidad final; devuelve nulos.
- La orden usa idempotencia; reintentos con otros parámetros son rechazados.
- Los eventos simulados verifican HMAC-SHA256 sobre cuerpo sin modificar, sello de tiempo ±5 min, ID único y estados permitidos.
- El historial sólo registra IDs opacos; jamás secretos, documentos o tarjetas.
- Ningún método puede mover o custodiar fondos, emitir un código cobrable o afirmar que un proveedor externo ha pagado.

## Elección de socio: verificación indispensable
Solicitar por escrito a cada potencial proveedor: entidad jurídica y licencia donde opere, cobertura real de fondeo en EE. UU., destinos Honduras, método de retiro en efectivo sin app, divisas, contrato y obligaciones KYC/AML, programa bancario, sandbox/API/documentación y webhooks, comisión y FX, reembolsos, responsabilidades regulatorias, integración de conciliación. **No asumir que una API internacional soporta la ruta US→HN, cash pickup o patrocinio de licencias.**

Empresas a evaluar mediante solicitudes empresariales (no se declara afiliación): redes y proveedores transfronterizos como Nium, Thunes o TerraPay, sujeto a confirmación escrita de cobertura, modelo, país y aceptación de Moneda Mundial.

## Pasos siguientes del negocio y de ingeniería
1. Identificar la jurisdicción de constitución y asesor legal US/NI.
2. Presentar expediente de empresa a potenciales socios; abrir conversación comercial y solicitar acceso de sandbox autorizado.
3. Elegir al menos un candidato con contrato y un equipo de cumplimiento que confirme los servicios permitidos.
4. Implementar un adaptador específico **backend-to-backend** según documentación vigente real del proveedor; nunca adivinar endpoints ni incluir llaves en React Native o GitHub.
5. Aislar fondos de clientes: libro mayor partida doble, conciliación, webhooks certificados, KYC/sanciones y antifraude; revisión independiente.
6. Piloto controlado únicamente con visto bueno jurídico, técnico, financiero y del socio, en corredor expresamente habilitado.

## Material preparado para un correo comercial
Asunto: Consulta de integración API y cobertura de remesas US → Honduras

Somos el proyecto Moneda Mundial 2.0. Evaluamos proveedores licenciados para remesas internacionales desde EE. UU. hacia Centroamérica, empezando por estudiar Honduras, con depósito bancario y retiro en efectivo sin teléfono. Buscamos programa regulado, alcance legal de cada entidad, obligaciones KYC/AML, documentación API/sandbox, webhooks, conciliación, reembolsos y cotización comercial. ¿Pueden confirmar por escrito cobertura real US→HN, entidades licenciadas y condiciones para evaluar una alianza? La aplicación está en desarrollo; no captamos ni movemos fondos reales.

**Regla de lanzamiento:** sin contrato, licencias/cobertura verificadas, auditoría, y autorización del socio, ningún código o interruptor convierte pruebas en operaciones reales.
