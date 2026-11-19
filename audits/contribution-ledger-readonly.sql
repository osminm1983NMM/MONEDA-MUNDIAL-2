-- Moneda Mundial 2.0 | Auditoría de aportaciones (SOLO LECTURA)
-- Ejecutar en SQL Editor del proyecto DEMO. No altera datos ni requiere rama Supabase.
-- Los MWD son créditos ficticios, NO dinero real.
-- Una aportación reduce la billetera; su contrapartida contable está pendiente de política.
-- No registrar automáticamente como ingreso, donación real ni dinero de clientes.

-- 1) Operaciones sin referencia en el libro contable.
select o.kind, count(*) as operaciones,
       count(t.id) as registradas_en_libro,
       count(*) - count(t.id) as pendientes
from public.mwd_operations o
left join mwd_finance_private.ledger_transactions t
  on t.external_reference = 'mwd-demo-transfer:' || o.id::text
group by o.kind order by o.kind;

-- 2) Comprobar asientos balanceados.
select count(*) as transacciones,
       count(*) filter (where total_debits <> total_credits) as descuadradas,
       coalesce(sum(total_debits - total_credits),0) as diferencia,
       count(*) filter (where entry_count <> 2) as asientos_no_esperados
from mwd_finance_private.ledger_balance_check;

-- 3) Conciliación individual sin exponer identificadores personales.
with movimientos as (
  select source_user_id as user_id, -amount_cents as delta
  from public.mwd_operations
  union all
  select destination_user_id as user_id, amount_cents as delta
  from public.mwd_operations where kind = 'transfer'
), netos as (
  select user_id, sum(delta) as neto
  from movimientos where user_id is not null group by user_id
)
select row_number() over (order by w.created_at, w.user_id) as billetera,
       w.balance_cents as saldo_actual_centavos,
       coalesce(n.neto,0) as cambio_registrado_centavos,
       w.balance_cents - coalesce(n.neto,0) as saldo_inicial_inferido_centavos
from public.mwd_wallets w
left join netos n on n.user_id = w.user_id
order by billetera;

-- 4) Alertas: si alguna cuenta tiene saldo inicial inferido distinto
-- al valor configurado, la vista existente lo reporta.
select audit_status, count(*) as cuentas
from mwd_finance_private.demo_wallet_opening_audit_v1
group by audit_status order by audit_status;

-- Política pendiente (NO ejecutar escrituras):
-- A) Definir si las aportaciones demo representan créditos retirados de circulación
--    o transferidos a un fondo interno ficticio.
-- B) Diseñar la cuenta contrapartida y categoría apropiadas.
-- C) Probar contabilización idempotente, reversos y backfill en entorno aislado.
-- D) Solo entonces habilitar un trigger contable para nuevas aportaciones.
