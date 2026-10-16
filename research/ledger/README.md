# Moneda Mundial — arquitectura de libro mayor y conciliación
16 octubre 2026. **Sólo investigación en PostgreSQL desechable CI. NO implementado en Supabase ni conectado a usuarios reales.**

## Entrega
- `research/ledger/postgres-double-entry-research.sql`: diseño de cuentas segregadas por divisa, diarios inmutables, dos o más líneas por asiento, controles DEBE = HABER por divisa, idempotencia para solicitudes repetidas y reporte de diferencias contra un extracto **ficticio**.
- `research/ledger/tests/ledger-assertions.sql`: prueba de registro balanceado USD, rechazo de operaciones desbalanceadas y compensación ilícita entre USD/HNL, doble solicitud, manipulación de asientos, acceso público y detección de diferencias.
- `.github/workflows/verificar-ledger-investigacion.yml`: PostgreSQL 17 aislado, credenciales únicamente de CI y sin conexión al proyecto financiero existente.

## Conceptos contables
Cada asiento enlaza una referencia a un evento comprobado y registra importes enteros en unidades menores de divisa. Ejemplo **ficticio** de USD 100: `debit BANK_CLEARING_USD 10000` y `credit CUSTOMER_PAYABLE_USD 10000`. No indica fondos realmente recibidos: la prueba solamente modela qué ocurriría *después* de la confirmación verificable de un proveedor financiero regulado.

Una conversión FX nunca debita USD y acredita HNL en un asiento desbalanceado; exige libros y asientos independientes por moneda y cuentas puente/posición FX, con fuente de tipo de cambio, límites y conciliación externos. Una eventual Coin y Digital tendrán libros y custodias separados; no usar el saldo ficticio MWD.

## Alcance de este prototipo
- No hay clientes, bancos, órdenes auténticas, depositantes, custodios, autorización financiera, liquidez ni blockchain conectada.
- Sólo usuario CI dueño de objetos SQL puede ejecutar la lógica. Acceso anon/authenticated revocado.
- El reporte se basa en montos proporcionados por fixture CI; `source_verified=false`. No afirma tener extracto bancario.
- Escrituras en una transacción de PostgreSQL; sin ledger de producción. Inmutabilidad por triggers de estudio; se requiere un diseño completo de gobierno/auditoría con cuentas y roles que el dueño de BD no pueda burlar.
- La prueba de conciliación es una instantánea pedagógica; en producción habrá que implementar corte temporal, secuencia continua, emparejamiento transacción a transacción, webhooks firmados, liquidación y reembolsos.

## Bloqueantes para mover dinero real
1. Constituir entidad y recibir asesoría financiera y legal por jurisdicción y modalidad.
2. Elegir y contratar proveedor regulado para US→HN; mantener Nicaragua y el resto del catálogo global para activación legal individual.
3. Aprobar programa KYC/KYB, AML, OFAC, protección consumidor, límites y reconciliación.
4. Diseñar infraestructura de backend y libro mayor producción con verificaciones transaccionales, segregación real de fondos, custodia, reversos y pruebas de resiliencia.
5. Estudiar Coin variable y Moneda Mundial Digital estable en componentes aislados y obtener aprobaciones aplicables antes de emisión/ventas/intercambios.

**La meta continúa siendo dinero verdadero, no un simulador permanente.** Este diseño permite probar las invariantes necesarias sin exponer fondos mientras los requisitos externos siguen pendientes.
