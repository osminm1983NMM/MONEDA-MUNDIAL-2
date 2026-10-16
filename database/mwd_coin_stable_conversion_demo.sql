-- MONEDA MUNDIAL • CONVERSIÓN COIN ↔ ESTABLE (SANDBOX)
-- SOLO créditos ficticios; sin token, stablecoin, reservas, mercado real ni pagos.
-- COIN y STABLE son cuentas distintas de MWD, sin puente hacia dinero real.
create schema if not exists mwd_swap_private;
revoke all on schema mwd_swap_private from public, anon, authenticated;

create table if not exists mwd_swap_private.demo_balances (
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_code text not null check (asset_code in ('COIN','STABLE')),
  balance_micro bigint not null check (balance_micro between 0 and 100000000000000),
  updated_at timestamptz not null default now(),
  primary key (user_id,asset_code)
);
create table if not exists mwd_swap_private.demo_pool (
  asset_code text primary key check (asset_code in ('COIN','STABLE')),
  balance_micro bigint not null check (balance_micro between 0 and 100000000000000)
);
-- Depósito virtual de prueba de 1,000,000 unidades en cada activo.
-- NO representa reservas reales, caja ni liquidez aportada por un proveedor.
insert into mwd_swap_private.demo_pool(asset_code,balance_micro)
values ('COIN',1000000000000),('STABLE',1000000000000)
on conflict (asset_code) do nothing;

create table if not exists mwd_swap_private.demo_rates (
  id text primary key check (id='sandbox_v1'),
  stable_per_coin numeric(18,8) not null check (stable_per_coin > 0),
  fee_bps integer not null check (fee_bps between 0 and 1000),
  active boolean not null default true,
  source_name text not null check (source_name='synthetic_sandbox'),
  updated_at timestamptz not null default now()
);
-- PRECIO SINTÉTICO ÚNICAMENTE PARA PROBAR FÓRMULAS; NO COTIZACIÓN DE MERCADO.
insert into mwd_swap_private.demo_rates(id,stable_per_coin,fee_bps,source_name)
values ('sandbox_v1',0.12500000,25,'synthetic_sandbox')
on conflict (id) do nothing;

create table if not exists mwd_swap_private.demo_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  from_asset text not null check (from_asset in ('COIN','STABLE')),
  to_asset text not null check (to_asset in ('COIN','STABLE')),
  amount_in_micro bigint not null check (amount_in_micro between 1000000 and 10000000000),
  gross_out_micro bigint not null check (gross_out_micro > 0),
  fee_out_micro bigint not null check (fee_out_micro >= 0),
  amount_out_micro bigint not null check (amount_out_micro > 0),
  stable_per_coin numeric(18,8) not null,
  provider text not null default 'synthetic_sandbox',
  status text not null default 'quoted' check (status in ('quoted','executed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  executed_at timestamptz,
  unique (user_id,client_request_id),
  check (from_asset <> to_asset),
  check (amount_out_micro = gross_out_micro - fee_out_micro)
);
create index if not exists demo_quotes_user_recent
  on mwd_swap_private.demo_quotes(user_id,created_at desc);

create table if not exists mwd_swap_private.demo_conversions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references mwd_swap_private.demo_quotes(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_asset text not null,
  to_asset text not null,
  amount_in_micro bigint not null,
  amount_out_micro bigint not null,
  fee_out_micro bigint not null,
  stable_per_coin numeric(18,8) not null,
  settled_at timestamptz not null default now()
);
create index if not exists demo_conversions_user_recent
  on mwd_swap_private.demo_conversions(user_id,settled_at desc);

-- Libro de entradas: 4 movimientos por conversión; sumatoria cero por activo.
create table if not exists mwd_swap_private.demo_journal (
  id bigint generated always as identity primary key,
  conversion_id uuid not null references mwd_swap_private.demo_conversions(id),
  asset_code text not null check (asset_code in ('COIN','STABLE')),
  account_type text not null check (account_type in ('user','sandbox_pool')),
  delta_micro bigint not null check (delta_micro <> 0),
  created_at timestamptz not null default now(),
  unique (conversion_id,asset_code,account_type)
);

alter table mwd_swap_private.demo_balances enable row level security;
alter table mwd_swap_private.demo_pool enable row level security;
alter table mwd_swap_private.demo_rates enable row level security;
alter table mwd_swap_private.demo_quotes enable row level security;
alter table mwd_swap_private.demo_conversions enable row level security;
alter table mwd_swap_private.demo_journal enable row level security;
revoke all on all tables in schema mwd_swap_private from public, anon, authenticated;
revoke all on all sequences in schema mwd_swap_private from public, anon, authenticated;

create or replace function mwd_swap_private.ensure_demo_balances(p_user uuid)
returns void language plpgsql security invoker set search_path='' as $fn$
begin
  if p_user is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  -- Bono ficticio concedido una sola vez a cada usuario de prueba.
  insert into mwd_swap_private.demo_balances(user_id,asset_code,balance_micro)
  values (p_user,'COIN',100000000),(p_user,'STABLE',1000000000)
  on conflict (user_id,asset_code) do nothing;
end; $fn$;
revoke all on function mwd_swap_private.ensure_demo_balances(uuid)
from public,anon,authenticated;

create or replace function public.mwd_conversion_wallet_demo()
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_user uuid := auth.uid();
  v_coin bigint;
  v_stable bigint;
  v_history jsonb;
begin
  if v_user is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  perform mwd_swap_private.ensure_demo_balances(v_user);
  select balance_micro into v_coin from mwd_swap_private.demo_balances
  where user_id=v_user and asset_code='COIN';
  select balance_micro into v_stable from mwd_swap_private.demo_balances
  where user_id=v_user and asset_code='STABLE';
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',h.id,'fromAsset',h.from_asset,'toAsset',h.to_asset,
    'amountInMicro',h.amount_in_micro,'amountOutMicro',h.amount_out_micro,
    'feeOutMicro',h.fee_out_micro,'priceSnapshot',h.stable_per_coin,
    'settledAt',h.settled_at) order by h.settled_at desc),'[]'::jsonb)
    into v_history
  from (select * from mwd_swap_private.demo_conversions
       where user_id=v_user order by settled_at desc limit 20) h;
  return jsonb_build_object('mode','sandbox_only','realPaymentsEnabled',false,
    'marketRateConnected',false,'stableBackedByReserves',false,
    'coinMicro',v_coin,'stableMicro',v_stable,'history',v_history);
end; $fn$;

create or replace function public.mwd_conversion_quote_demo(
  p_from_asset text, p_amount_micro bigint, p_client_request_id uuid
)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_user uuid := auth.uid();
  v_to text;
  v_rate mwd_swap_private.demo_rates%rowtype;
  v_quote mwd_swap_private.demo_quotes%rowtype;
  v_gross bigint;
  v_fee bigint;
  v_net bigint;
begin
  if v_user is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  if p_from_asset is null or p_from_asset not in ('COIN','STABLE')
     or p_amount_micro is null or p_amount_micro not between 1000000 and 10000000000
     or p_client_request_id is null then
    raise exception 'Solicitud de conversión inválida' using errcode='22023';
  end if;
  v_to := case when p_from_asset='COIN' then 'STABLE' else 'COIN' end;
  perform mwd_swap_private.ensure_demo_balances(v_user);
  select * into v_quote from mwd_swap_private.demo_quotes q
  where q.user_id=v_user and q.client_request_id=p_client_request_id;
  if found then
    if v_quote.from_asset<>p_from_asset or v_quote.amount_in_micro<>p_amount_micro then
      raise exception 'Identificador reutilizado con otros parámetros' using errcode='22023';
    end if;
  else
    select * into v_rate from mwd_swap_private.demo_rates
      where id='sandbox_v1' and active=true;
    if not found then
      raise exception 'Simulador de cotizaciones no disponible' using errcode='22023';
    end if;
    v_gross := case when p_from_asset='COIN'
      then floor(p_amount_micro::numeric * v_rate.stable_per_coin)::bigint
      else floor(p_amount_micro::numeric / v_rate.stable_per_coin)::bigint end;
    v_fee := ceil(v_gross::numeric * v_rate.fee_bps / 10000)::bigint;
    v_net := v_gross-v_fee;
    if v_net<=0 then raise exception 'Importe menor que el mínimo del simulador' using errcode='22023'; end if;
    insert into mwd_swap_private.demo_quotes
      (user_id,client_request_id,from_asset,to_asset,amount_in_micro,
       gross_out_micro,fee_out_micro,amount_out_micro,stable_per_coin,expires_at)
    values (v_user,p_client_request_id,p_from_asset,v_to,p_amount_micro,
       v_gross,v_fee,v_net,v_rate.stable_per_coin,clock_timestamp()+interval '90 seconds')
    on conflict (user_id,client_request_id) do nothing;
    -- Captura simultaneidad de la misma solicitud.
    select * into v_quote from mwd_swap_private.demo_quotes q
    where q.user_id=v_user and q.client_request_id=p_client_request_id;
    if v_quote.from_asset<>p_from_asset or v_quote.amount_in_micro<>p_amount_micro then
      raise exception 'Identificador reutilizado con otros parámetros' using errcode='22023';
    end if;
  end if;
  return jsonb_build_object(
    'quoteId',v_quote.id,'status',v_quote.status,'provider','synthetic_sandbox',
    'fromAsset',v_quote.from_asset,'toAsset',v_quote.to_asset,
    'amountInMicro',v_quote.amount_in_micro,'grossOutMicro',v_quote.gross_out_micro,
    'feeOutMicro',v_quote.fee_out_micro,'amountOutMicro',v_quote.amount_out_micro,
    'stablePerCoin',v_quote.stable_per_coin,'expiresAt',v_quote.expires_at,
    'realPaymentsEnabled',false,'priceIsReal',false
  );
end; $fn$;

create or replace function public.mwd_conversion_confirm_demo(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  v_user uuid := auth.uid();
  v_quote mwd_swap_private.demo_quotes%rowtype;
  v_conversion_id uuid;
  v_locked integer;
  v_user_from bigint;
  v_user_to bigint;
  v_pool_to bigint;
begin
  if v_user is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
  if p_quote_id is null then raise exception 'Falta cotización' using errcode='22023'; end if;
  select * into v_quote from mwd_swap_private.demo_quotes q
    where q.id=p_quote_id and q.user_id=v_user for update;
  if not found then raise exception 'Cotización no disponible' using errcode='22023'; end if;
  if v_quote.status='executed' then
    select id into v_conversion_id from mwd_swap_private.demo_conversions
      where quote_id=p_quote_id and user_id=v_user;
    if v_conversion_id is null then
      raise exception 'Asiento pendiente de reconciliación' using errcode='55000';
    end if;
    return jsonb_build_object('status','already_processed','conversionId',v_conversion_id,
      'quoteId',p_quote_id,'realPaymentsEnabled',false);
  end if;
  if v_quote.expires_at<=clock_timestamp() then
    raise exception 'Cotización vencida. Solicita otra.' using errcode='22023';
  end if;
  perform mwd_swap_private.ensure_demo_balances(v_user);
  -- Orden global de bloqueos: pool COIN, STABLE, luego usuario COIN, STABLE.
  perform 1 from mwd_swap_private.demo_pool order by asset_code for update;
  get diagnostics v_locked=row_count;
  if v_locked<>2 then raise exception 'Falta saldo de la bolsa de prueba'; end if;
  perform 1 from mwd_swap_private.demo_balances where user_id=v_user
    order by asset_code for update;
  get diagnostics v_locked=row_count;
  if v_locked<>2 then raise exception 'Faltan saldos de demostración'; end if;
  select balance_micro into v_user_from from mwd_swap_private.demo_balances
    where user_id=v_user and asset_code=v_quote.from_asset;
  select balance_micro into v_user_to from mwd_swap_private.demo_balances
    where user_id=v_user and asset_code=v_quote.to_asset;
  select balance_micro into v_pool_to from mwd_swap_private.demo_pool
    where asset_code=v_quote.to_asset;
  if v_user_from<v_quote.amount_in_micro then
    raise exception 'Saldo de prueba insuficiente' using errcode='22023';
  end if;
  if v_pool_to<v_quote.amount_out_micro then
    raise exception 'Liquidez ficticia de prueba insuficiente' using errcode='22023';
  end if;
  if v_user_to>100000000000000-v_quote.amount_out_micro then
    raise exception 'Límite de saldo de prueba' using errcode='22023';
  end if;

  update mwd_swap_private.demo_balances
    set balance_micro=balance_micro-v_quote.amount_in_micro,updated_at=now()
    where user_id=v_user and asset_code=v_quote.from_asset;
  update mwd_swap_private.demo_pool
    set balance_micro=balance_micro+v_quote.amount_in_micro
    where asset_code=v_quote.from_asset;
  update mwd_swap_private.demo_pool
    set balance_micro=balance_micro-v_quote.amount_out_micro
    where asset_code=v_quote.to_asset;
  update mwd_swap_private.demo_balances
    set balance_micro=balance_micro+v_quote.amount_out_micro,updated_at=now()
    where user_id=v_user and asset_code=v_quote.to_asset;

  insert into mwd_swap_private.demo_conversions
    (quote_id,user_id,from_asset,to_asset,amount_in_micro,
     amount_out_micro,fee_out_micro,stable_per_coin)
  values (v_quote.id,v_user,v_quote.from_asset,v_quote.to_asset,v_quote.amount_in_micro,
          v_quote.amount_out_micro,v_quote.fee_out_micro,v_quote.stable_per_coin)
  returning id into v_conversion_id;

  insert into mwd_swap_private.demo_journal
    (conversion_id,asset_code,account_type,delta_micro)
  values (v_conversion_id,v_quote.from_asset,'user',-v_quote.amount_in_micro),
         (v_conversion_id,v_quote.from_asset,'sandbox_pool',v_quote.amount_in_micro),
         (v_conversion_id,v_quote.to_asset,'sandbox_pool',-v_quote.amount_out_micro),
         (v_conversion_id,v_quote.to_asset,'user',v_quote.amount_out_micro);

  update mwd_swap_private.demo_quotes set status='executed',executed_at=now()
    where id=v_quote.id;
  return jsonb_build_object('status','ok','conversionId',v_conversion_id,
    'quoteId',v_quote.id,'fromAsset',v_quote.from_asset,'toAsset',v_quote.to_asset,
    'amountInMicro',v_quote.amount_in_micro,'amountOutMicro',v_quote.amount_out_micro,
    'feeOutMicro',v_quote.fee_out_micro,'realPaymentsEnabled',false);
end; $fn$;

revoke all on function public.mwd_conversion_wallet_demo() from public,anon,authenticated;
revoke all on function public.mwd_conversion_quote_demo(text,bigint,uuid) from public,anon,authenticated;
revoke all on function public.mwd_conversion_confirm_demo(uuid) from public,anon,authenticated;
grant execute on function public.mwd_conversion_wallet_demo() to authenticated;
grant execute on function public.mwd_conversion_quote_demo(text,bigint,uuid) to authenticated;
grant execute on function public.mwd_conversion_confirm_demo(uuid) to authenticated;
