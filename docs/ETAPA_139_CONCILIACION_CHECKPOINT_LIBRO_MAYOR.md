# Moneda Mundial 2.0 — etapa 139: conciliación de solicitudes y saldos ficticios

La etapa 139 vincula **el checkpoint persistente de la etapa 138** al
**libro mayor de partida doble** que ya existía en investigación.
Se prueba exclusivamente contra PostgreSQL 16 **desechable** (`ledger_test`).
Ni Supabase activo, ni la APK Samsung, ni saldos de clientes cambian.

## Contrato de investigación

1. Cada actor de prueba tiene una cuenta de obligación a clientes y otra de
   pagos pendientes, ambas en USD. Los fondos iniciales son asientos **inventados**.
2. Se publica un asiento únicamente si la reserva tiene estado `verified_mock`
   y un recibo generado manualmente en la prueba. Es solo un dato ficticio;
   **no prueba que un banco haya confirmado nada**.
3. La cuenta sintética se bloquea con `FOR UPDATE`, se verifica el saldo
   ficticio disponible, se escribe el asiento balanceado y se guarda el
   vínculo al recibo **en una transacción**. El reintento devuelve el mismo
   asiento sin descontar nuevamente. Los saldos negativos se rechazan.
4. Una inspección calcula el saldo y el historial desde líneas contables
   persistentes, verifica que cada recibo apuntó a dos líneas por el monto
   original y etiqueta expresamente `real_money_enabled: false`.

## Ejemplo verificable, no operativo

| Cuenta | Saldo DEMO inicial | Solicitud ficticia contabilizada | Saldo DEMO final |
|---|---:|---:|---:|
| A, destino Honduras | USD 500.00 | USD 100.00 | USD 400.00 |
| B, destino Nicaragua | USD 600.00 | USD 200.00 | USD 400.00 |

Primero A y B mantienen sus saldos. Tras contabilizar A, B todavía conserva
USD 600.00 y la segunda solicitud pendiente de A tampoco descuenta saldo.
Una **nueva conexión** de PostgreSQL recupera A, confirma y contabiliza B
manualmente, y comprueba que ambas tengan un único asiento de salida y el
historial correcto. Una tercera cuenta sin fondeo DEMO no puede descontar.

Honduras y Nicaragua son solo ejemplos. No se eliminan países del catálogo.

## Pendiente antes de dinero real

- Identidad/autorización de servidor vinculada a los titulares reales.
- Confirmación criptográficamente/verificable del proveedor regulado; nunca
  permitir que el cliente declare `verified_mock` como pago verdadero.
- Conciliación externa contra custodia real, liquidaciones y compensaciones;
  auditoría, recuperación de caídas y pruebas adversarias exhaustivas.
- Revisión regulatoria, licencias y proveedores por cada país habilitado.

Referencias de implementación: documentación oficial de
[transacciones PostgreSQL](https://www.postgresql.org/docs/current/tutorial-transactions.html),
[bloqueo de filas](https://www.postgresql.org/docs/current/explicit-locking.html)
y [acceso API y RLS en Supabase](https://supabase.com/docs/guides/api/securing-your-api).
