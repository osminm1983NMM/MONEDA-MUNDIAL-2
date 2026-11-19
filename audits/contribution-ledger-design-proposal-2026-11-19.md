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
