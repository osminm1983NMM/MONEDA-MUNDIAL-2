# Diseño de cierre de aportaciones DEMO — propuesta, no aprobada

Fecha: 2026-11-19. **Sin DDL, DML, RPC de escritura ni cambio de saldos.**

## Evidencia
- `public.mwd_contribute_demo` autentica con `auth.uid()`, bloquea la billetera `FOR UPDATE`, valida UUID e importe, descuenta el saldo ficticio y crea `mwd_operations.kind='contribution'`.
- La función no escribe en `mwd_finance_private.ledger_transactions` ni `ledger_entries`.
- Hay 6 aportaciones existentes por 2,400 centavos ficticios. El libro mayor contiene 5 cuentas `customer_liability` y 19 transferencias de doble entrada conciliadas, pero ninguna cuenta específica de aportaciones.
- **No asumir** que las aportaciones constituyen donaciones reales ni que deben destinarse a un fondo social hasta decisión del propietario.

## Decisión requerida antes de implementar
Elegir la naturaleza contable de los créditos aportados: (A) fondo social ficticio restringido; (B) retiro/extinción de créditos de demostración; (C) otra cuenta de destino especificada. El nombre y tipo de la cuenta de contrapartida dependen de esa decisión y de la política de emisión inicial de MWD.

## Diseño técnico para cuando exista aprobación
1. Revisar los triggers y funciones contables vigentes para evitar doble contabilización; diseñar una cuenta interna específica en `mwd_finance_private`, sin exponerla por Data API.
2. Dentro de la **misma transacción** que descuenta la billetera e inserta la operación, crear una transacción de libro mayor con referencia determinista `mwd-demo-contribution:<operation_id>` y dos asientos de igual importe, en la orientación que corresponda al modelo contable aprobado.
3. La ruta `already_processed` debe recuperar el registro original sin descontar ni contabilizar dos veces. Asegurar unicidad de referencia y de solicitud.
4. Para las seis aportaciones históricas, preparar backfill idempotente **solo tras respaldo, validación y aprobación expresa**; comprobar 6/6 coincidencias y 0 descuadres antes y después.
5. Añadir pruebas de autorización, concurrencia, error tras commit, reintento y rollback; verificar en Android.
6. No habilitar dinero real, no fusionar `main` ni desplegar SQL sin autorización.

## Criterio de aceptación
Conciliación 6/6, cero duplicados, saldo histórico sin cambios por backfill, asientos equilibrados, denegación a usuarios no autorizados y pruebas reales registradas.

## Decisión del propietario y restricciones reales — 19 noviembre 2026
- Propietario **aprobó** la opción A: fondo social **ficticio** separado. La aprobación no autoriza dinero real ni la ejecución inmediata de un backfill irreversible.
- Catálogo SQL inspeccionado: `ledger_accounts.account_type` solo permite `customer_liability`, `provider_clearing`, `fee_revenue` y `suspense`; `ledger_transactions.transaction_kind` solo permite `deposit`, `withdrawal`, `wallet_transfer`, `direct_transfer`, `fee`, `reversal`. Por tanto, **no existe** un tipo `social_fund` ni `contribution` permitido actualmente.
- Antes de desplegar, preparar una migración versionada que amplíe **explícitamente** los CHECK constraints con tipos específicos `social_fund` y `contribution`, luego cuenta interna `MWD-DEMO-SOCIAL-FUND` y asiento por operación. Revisar primero los triggers existentes, el orden contable debit/credit para cuentas de pasivo, RLS y privilegios. Evitar utilizar `suspense` como atajo para clasificar el fondo social.
- **No se aplicó migración** en Supabase ni se contabilizaron las seis aportaciones anteriores; primero deben existir pruebas y un plan de reversión. El historial actual permanece intacto.

## Inspección de triggers existentes y aprobación de la ejecución automática — 19 noviembre 2026
- GitHub Actions run #239 (`44546477709`), commit `d7b640c`: **completed/success**. La corrección de referencias de usuario en `App.js` pasó las comprobaciones automatizadas.
- Se verificó el trigger `public.mwd_operations.mwd_auto_ledger_transfer_v1` (`AFTER INSERT`): ejecuta `mwd_finance_private.post_demo_transfer_ledger_v1()`.
- Se inspeccionó el cuerpo de la función: **solo procesa `new.kind='transfer'`**, crea cuentas si faltan, transacción `draft`, dos asientos, y luego marca `posted`; para `contribution` devuelve `new` sin asiento. La escritura ocurre en la transacción de la inserción original.
- Los triggers del libro mayor impiden inserción directa de transacciones `posted`, validan moneda y protegen transacciones/asientos contabilizados. Una futura extensión para aportaciones debe seguir el patrón **draft → entries → posted**, no insertar directamente `posted`.
- Diseño preferente: añadir un trigger específico para aportaciones o ampliar cuidadosamente el existente, con referencia determinista única, cuenta social interna y prueba de backfill idempotente. No modificar el trigger de transferencias sin una regresión 19/19.
- No se ejecutaron escrituras en Supabase; la migración y el backfill siguen pendientes de pruebas y despliegue controlado.
