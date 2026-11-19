# Conciliación contable de demostración — 2026-11-19

Consultas SQL **solo lectura** en Supabase. Ningún saldo u operación fue modificado.

## Resultado observado
- 5 billeteras; 0 saldos negativos.
- 25 operaciones: 19 transferencias (21700 centavos MWD) y 6 aportaciones (2400 centavos MWD).
- Suma de saldos: 4,997,600 centavos MWD.
- Saldo inicial esperado bajo supuesto de 5 cuentas × 1,000,000 centavos: 5,000,000 centavos MWD.
- Saldo esperado después de aportaciones: 5,000,000 - 2,400 = **4,997,600** centavos.
- Conciliación individual: **5 verificadas, 0 discrepancias, 0 centavos de diferencia absoluta**.
- Restricción SQL `mwd_unique_request UNIQUE(actor_id,request_id)` presente.

## Consulta de conciliación individual
```sql
with changes as (
  select user_id, sum(delta) as delta
  from (
    select source_user_id as user_id, -amount_cents as delta
    from public.mwd_operations
    union all
    select destination_user_id as user_id, amount_cents as delta
    from public.mwd_operations
    where destination_user_id is not null
  ) x
  group by user_id
)
select count(*) as wallets_checked,
       count(*) filter (
         where w.balance_cents <> 1000000 + coalesce(c.delta,0)
       ) as discrepancies,
       coalesce(sum(abs(w.balance_cents-(1000000+coalesce(c.delta,0)))),0)
         as absolute_difference_cents
from public.mwd_wallets w
left join changes c on c.user_id=w.user_id;
```

**Alcance:** el cálculo presupone saldo inicial de 10,000 MWD por billetera y ausencia de ajustes fuera de `mwd_operations`. No demuestra por sí mismo ausencia de modificaciones históricas ni seguridad bajo solicitudes simultáneas. No se ejecutaron transacciones de prueba.
