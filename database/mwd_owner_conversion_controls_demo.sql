-- MONEDA MUNDIAL 2.0: control del simulador COIN <-> STABLE.
-- Prohibido usar estos saldos como dinero. Todos los valores son sintéticos.
-- Requiere previamente database/mwd_coin_stable_conversion_demo.sql.
create table if not exists mwd_swap_private.demo_policy_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  previous_active boolean not null,
  new_active boolean not null,
  previous_rate numeric(18,8) not null,
  new_rate numeric(18,8) not null,
  previous_fee_bps integer not null,
  new_fee_bps integer not null,
  reason text not null check(char_length(reason) between 8 and 300),
  changed_at timestamptz not null default clock_timestamp()
);
alter table mwd_swap_private.demo_policy_audit enable row level security;
revoke all on mwd_swap_private.demo_policy_audit from public, anon, authenticated;
revoke all on sequence mwd_swap_private.demo_policy_audit_id_seq
  from public, anon, authenticated;

-- Segunda barrera del servidor. Al pausar, bloquea las cotizaciones NUEVAS
-- y también el uso de cotizaciones emitidas antes de la pausa.
-- El bloqueo FOR SHARE se sincroniza con cambios de política (FOR UPDATE).
create or replace function mwd_swap_private.reject_paused_conversion_demo()
returns trigger language plpgsql security invoker set search_path='' as $fn$
declare v_active boolean;
begin
  select r.active into v_active
  from mwd_swap_private.demo_rates r
  where r.id='sandbox_v1' for share;
  if v_active is distinct from true then
    raise exception 'Simulador pausado: no se permiten conversiones ficticias'
      using errcode='55000';
  end if;
  return new;
end; $fn$;
revoke all on function mwd_swap_private.reject_paused_conversion_demo()
  from public,anon,authenticated;
drop trigger if exists check_demo_conversion_active on mwd_swap_private.demo_conversions;
create trigger check_demo_conversion_active
  before insert on mwd_swap_private.demo_conversions
  for each row execute function mwd_swap_private.reject_paused_conversion_demo();

-- Monitor administrativo: cifras agregadas, sin identidad de clientes.
create or replace function public.mwd_owner_conversion_dashboard_demo()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare
  v_actor uuid;
  v_rate mwd_swap_private.demo_rates%rowtype;
  v_quotes bigint;
  v_live_quotes bigint;
  v_conversions bigint;
  v_wallet_count bigint;
  v_pool jsonb;
  v_wallets jsonb;
  v_fees jsonb;
  v_unbalanced bigint;
  v_incomplete bigint;
  v_audit jsonb;
begin
  v_actor := mwd_partners_private.assert_owner();

  select * into v_rate from mwd_swap_private.demo_rates where id='sandbox_v1';
  if not found then
    raise exception 'Política del simulador no configurada' using errcode='55000';
  end if;

  select count(*),count(*) filter(where status='quoted' and expires_at>now())
  into v_quotes,v_live_quotes from mwd_swap_private.demo_quotes;
  select count(*) into v_conversions from mwd_swap_private.demo_conversions;
  select count(distinct user_id) into v_wallet_count from mwd_swap_private.demo_balances;

  select coalesce(jsonb_object_agg(p.asset_code,p.balance_micro),'{}'::jsonb)
    into v_pool from mwd_swap_private.demo_pool p;
  select coalesce(jsonb_object_agg(b.asset_code,b.total_micro),'{}'::jsonb)
    into v_wallets
  from (select asset_code,sum(balance_micro) total_micro
        from mwd_swap_private.demo_balances group by asset_code) b;
  select coalesce(jsonb_object_agg(f.to_asset,f.total_micro),'{}'::jsonb)
    into v_fees
  from (select to_asset,sum(fee_out_micro) total_micro
        from mwd_swap_private.demo_conversions group by to_asset) f;

  select count(*) into v_unbalanced from (
    select conversion_id, asset_code
    from mwd_swap_private.demo_journal
    group by conversion_id,asset_code
    having sum(delta_micro)<>0 or count(*)<>2
  ) bad;
  select count(*) into v_incomplete from mwd_swap_private.demo_conversions c
  where (select count(*) from mwd_swap_private.demo_journal j
          where j.conversion_id=c.id) <> 4;

  select coalesce(jsonb_agg(jsonb_build_object(
     'id',a.id,'actorId',a.actor_id,'previousActive',a.previous_active,
     'newActive',a.new_active,'previousRate',a.previous_rate,
     'newRate',a.new_rate,'previousFeeBps',a.previous_fee_bps,
     'newFeeBps',a.new_fee_bps,'reason',a.reason,'changedAt',a.changed_at)
     order by a.changed_at desc,a.id desc),'[]'::jsonb)
  into v_audit
  from (select * from mwd_swap_private.demo_policy_audit
        order by changed_at desc,id desc limit 25) a;

  return jsonb_build_object(
    'mode','sandbox_only','realPaymentsEnabled',false,
    'stableBackedByReserves',false,'marketRateConnected',false,
    'active',v_rate.active,'stablePerCoin',v_rate.stable_per_coin,
    'feeBps',v_rate.fee_bps,'updatedAt',v_rate.updated_at,
    'quoteCount',v_quotes,'activeQuoteCount',v_live_quotes,
    'conversionCount',v_conversions,'walletCount',v_wallet_count,
    'poolBalancesMicro',v_pool,'walletBalancesMicro',v_wallets,
    'feesRetainedMicro',v_fees,
    'unbalancedJournalGroups',v_unbalanced,'incompleteJournals',v_incomplete,
    'recentPolicyChanges',v_audit);
end; $fn$;

-- Cambio supervisado de tarifa ficticia o pausa/reanudación.
-- Token de versión previene sobrescribir otro cambio administrativo.
create or replace function public.mwd_owner_conversion_policy_demo(
  p_active boolean,
  p_stable_per_coin numeric,
  p_fee_bps integer,
  p_reason text,
  p_expected_updated_at timestamptz
)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_actor uuid;
  v_old mwd_swap_private.demo_rates%rowtype;
  v_changed_at timestamptz;
  v_reason text := btrim(coalesce(p_reason,''));
begin
  v_actor := mwd_partners_private.assert_owner();
  if p_active is null or p_stable_per_coin is null
     or p_stable_per_coin not between 0.01 and 5
     or p_stable_per_coin <> round(p_stable_per_coin,8)
     or p_fee_bps is null or p_fee_bps not between 0 and 500
     or char_length(v_reason) not between 8 and 300
     or p_expected_updated_at is null then
    raise exception 'Configuración de prueba inválida'
      using errcode='22023';
  end if;
  select * into v_old from mwd_swap_private.demo_rates
    where id='sandbox_v1' for update;
  if not found then
    raise exception 'Simulador sin configuración' using errcode='55000';
  end if;
  if v_old.updated_at is distinct from p_expected_updated_at then
    raise exception 'La política cambió. Actualiza el panel antes de guardar.'
      using errcode='40001';
  end if;
  if v_old.active=p_active
     and v_old.stable_per_coin=p_stable_per_coin
     and v_old.fee_bps=p_fee_bps then
    return jsonb_build_object('status','no_change','active',v_old.active);
  end if;

  v_changed_at := clock_timestamp();
  update mwd_swap_private.demo_rates
    set active=p_active,stable_per_coin=p_stable_per_coin,
        fee_bps=p_fee_bps,updated_at=v_changed_at
    where id='sandbox_v1';
  insert into mwd_swap_private.demo_policy_audit
    (actor_id,previous_active,new_active,previous_rate,new_rate,
     previous_fee_bps,new_fee_bps,reason)
    values(v_actor,v_old.active,p_active,v_old.stable_per_coin,p_stable_per_coin,
           v_old.fee_bps,p_fee_bps,v_reason);
  return jsonb_build_object('status','updated','active',p_active,
    'stablePerCoin',p_stable_per_coin,'feeBps',p_fee_bps,
    'updatedAt',v_changed_at,'realPaymentsEnabled',false);
end; $fn$;

revoke all on function public.mwd_owner_conversion_dashboard_demo()
  from public,anon,authenticated;
revoke all on function public.mwd_owner_conversion_policy_demo(boolean,numeric,integer,text,timestamptz)
  from public,anon,authenticated;
grant execute on function public.mwd_owner_conversion_dashboard_demo()
  to authenticated;
grant execute on function public.mwd_owner_conversion_policy_demo(boolean,numeric,integer,text,timestamptz)
  to authenticated;
