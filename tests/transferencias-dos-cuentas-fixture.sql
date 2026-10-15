-- Moneda Mundial 2.0 — dos cuentas ficticias, solo PostgreSQL desechable CI.
-- Las definiciones RPC siguientes se tomaron (solo lectura) del backend demo,
-- para comprobar en aislamiento las mismas reglas que usa Android.
-- NO USA USUARIOS REALES, CONTRASEÑAS, SUPABASE NI DINERO REAL.
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $uid$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$uid$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.mwd_wallets(
  user_id uuid PRIMARY KEY,
  account_code text NOT NULL UNIQUE,
  balance_cents bigint NOT NULL DEFAULT 1000000
    CHECK (balance_cents>=0 AND balance_cents<=100000000000)
);
CREATE TABLE public.mwd_operations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL, request_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('transfer','contribution')),
  source_user_id uuid NOT NULL, destination_user_id uuid,
  amount_cents bigint NOT NULL CHECK (amount_cents>=1 AND amount_cents<=100000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mwd_unique_request UNIQUE(actor_id,request_id),
  CONSTRAINT mwd_operation_shape CHECK(
    (kind='transfer' AND destination_user_id IS NOT NULL AND source_user_id<>destination_user_id)
    OR (kind='contribution' AND destination_user_id IS NULL)
  )
);
CREATE TABLE public.mwd_merchants(
  owner_user_id uuid PRIMARY KEY,
  business_name text NOT NULL,
  country_code text NOT NULL DEFAULT 'US',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mwd_payment_requests(
  id uuid PRIMARY KEY,
  merchant_user_id uuid NOT NULL REFERENCES public.mwd_merchants(owner_user_id),
  amount_cents bigint NOT NULL CHECK(amount_cents>=1 AND amount_cents<=100000000),
  currency_code text NOT NULL DEFAULT 'MWD' CHECK(currency_code='MWD'),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled','expired')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mwd_admin_roles(
  user_id uuid PRIMARY KEY,
  role text NOT NULL CHECK(role IN ('owner','support'))
);

-- Los datos de ensayo se insertan ANTES de configurar acceso de cliente.
INSERT INTO public.mwd_wallets(user_id,account_code,balance_cents) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MWD-AAAAAAAAAAAAAAAA',1000000),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','MWD-BBBBBBBBBBBBBBBB',1000000);
INSERT INTO public.mwd_merchants(owner_user_id,business_name)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Comercio ficticio A');
INSERT INTO public.mwd_payment_requests(id,merchant_user_id,amount_cents) VALUES
('10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',200),
('10000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',300);
INSERT INTO public.mwd_admin_roles(user_id,role)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner');

ALTER TABLE public.mwd_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mwd_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mwd_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mwd_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mwd_admin_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_own ON public.mwd_wallets TO authenticated
 USING ((SELECT auth.uid())=user_id);
CREATE POLICY operation_participants ON public.mwd_operations FOR SELECT TO authenticated
 USING ((SELECT auth.uid())=source_user_id OR (SELECT auth.uid())=destination_user_id);
CREATE POLICY merchant_own ON public.mwd_merchants FOR SELECT TO authenticated
 USING ((SELECT auth.uid())=owner_user_id);
CREATE POLICY requests_own ON public.mwd_payment_requests FOR SELECT TO authenticated
 USING ((SELECT auth.uid())=merchant_user_id);
CREATE POLICY roles_own ON public.mwd_admin_roles FOR SELECT TO authenticated
 USING ((SELECT auth.uid())=user_id);

-- Permisos de lectura exclusivos de datos propios; no existe escritura directa.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.mwd_wallets,public.mwd_operations,public.mwd_merchants,
 public.mwd_payment_requests,public.mwd_admin_roles TO authenticated;

-- Funciones SECURTY DEFINER auténticas del servidor de ensayo (sin ejecutar SQL de
-- datos suministrados por otras personas). Su source es el backend demo.
CREATE OR REPLACE FUNCTION public.mwd_cancel_payment_request_demo(p_payment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid := auth.uid(); v_status text;
begin
 if v_actor is null then raise exception 'Debes iniciar sesion'; end if;
 if p_payment_id is null then raise exception 'Solicitud invalida'; end if;
 select status into v_status from public.mwd_payment_requests
 where id=p_payment_id and merchant_user_id=v_actor for update;
 if not found then raise exception 'Solicitud no disponible'; end if;
 if v_status = 'paid' then raise exception 'No se puede cancelar un pago realizado'; end if;
 if v_status = 'pending' then
   update public.mwd_payment_requests set status='cancelled' where id=p_payment_id;
   return jsonb_build_object('status','cancelled','payment_id',p_payment_id);
 end if;
 return jsonb_build_object('status',v_status,'payment_id',p_payment_id);
end $function$;

CREATE OR REPLACE FUNCTION public.mwd_contribute_demo(p_amount_cents bigint, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_balance bigint;
  v_existing public.mwd_operations%rowtype;
  v_operation_id uuid;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion';
  end if;
  if p_request_id is null or p_amount_cents is null
    or p_amount_cents < 1 or p_amount_cents > 100000000 then
    raise exception 'Solicitud o cantidad invalida';
  end if;

  select w.balance_cents into v_balance from public.mwd_wallets w
    where w.user_id = v_actor for update;
  if not found then
    raise exception 'Cuenta de prueba no disponible';
  end if;

  select * into v_existing from public.mwd_operations o
    where o.actor_id = v_actor and o.request_id = p_request_id;
  if found then
    if v_existing.kind <> 'contribution'
      or v_existing.source_user_id <> v_actor
      or v_existing.amount_cents <> p_amount_cents then
      raise exception 'Identificador ya usado para otra operacion';
    end if;
    return jsonb_build_object('status', 'already_processed',
      'operation_id', v_existing.id, 'balance_cents', v_balance);
  end if;

  if v_balance < p_amount_cents then
    raise exception 'Saldo ficticio insuficiente';
  end if;

  update public.mwd_wallets
    set balance_cents = balance_cents - p_amount_cents
    where user_id = v_actor;

  insert into public.mwd_operations
    (actor_id, request_id, kind, source_user_id, amount_cents)
    values (v_actor, p_request_id, 'contribution', v_actor, p_amount_cents)
    returning id into v_operation_id;

  return jsonb_build_object('status', 'ok',
    'operation_id', v_operation_id, 'balance_cents', v_balance - p_amount_cents);
end
$function$;

CREATE OR REPLACE FUNCTION public.mwd_get_payment_request_demo(p_payment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ DECLARE v_request public.mwd_payment_requests%rowtype; v_name text; v_actor uuid := auth.uid(); BEGIN IF v_actor IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesion'; END IF; IF p_payment_id IS NULL THEN RAISE EXCEPTION 'Solicitud invalida'; END IF; SELECT * INTO v_request FROM public.mwd_payment_requests WHERE id=p_payment_id AND (status='pending' OR merchant_user_id=v_actor); IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no disponible'; END IF; SELECT business_name INTO v_name FROM public.mwd_merchants WHERE owner_user_id=v_request.merchant_user_id; RETURN jsonb_build_object('id',v_request.id,'business_name',v_name,'amount_cents',v_request.amount_cents,'currency_code',v_request.currency_code,'status',v_request.status,'description',v_request.description); END $function$;

CREATE OR REPLACE FUNCTION public.mwd_owner_summary_demo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not exists
     (select 1 from public.mwd_admin_roles
      where user_id = auth.uid() and role = 'owner') then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'cuentas', (select count(*) from public.mwd_wallets),
    'comercios', (select count(*) from public.mwd_merchants),
    'transferencias', (select count(*) from public.mwd_operations where kind='transfer'),
    'aportaciones', (select count(*) from public.mwd_operations where kind='contribution'),
    'cobros_pagados', (select count(*) from public.mwd_payment_requests where status='paid'),
    'saldo_demo_centavos', (select coalesce(sum(balance_cents),0) from public.mwd_wallets)
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.mwd_pay_merchant_demo(p_payment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid := auth.uid(); v_request public.mwd_payment_requests%rowtype; v_code text; v_result jsonb;
begin
 if v_actor is null then raise exception 'Debes iniciar sesion'; end if;
 if p_payment_id is null then raise exception 'Solicitud invalida'; end if;
 select * into v_request from public.mwd_payment_requests where id=p_payment_id for update;
 if not found then raise exception 'Solicitud no disponible'; end if;
 if v_request.merchant_user_id=v_actor then raise exception 'No puedes pagarte a ti mismo'; end if;
 if v_request.currency_code <> 'MWD' then raise exception 'Solo pagos de prueba'; end if;
 if v_request.status = 'paid' then
   if exists(select 1 from public.mwd_operations where actor_id=v_actor and request_id=p_payment_id and destination_user_id=v_request.merchant_user_id and amount_cents=v_request.amount_cents) then
     return jsonb_build_object('status','already_processed','payment_id',p_payment_id);
   end if;
   raise exception 'Solicitud ya pagada';
 end if;
 if v_request.status <> 'pending' then raise exception 'Solicitud no disponible'; end if;
 select account_code into v_code from public.mwd_wallets where user_id=v_request.merchant_user_id;
 if v_code is null then raise exception 'Comercio sin billetera de prueba'; end if;
 v_result := public.mwd_transfer_demo(v_code,v_request.amount_cents,p_payment_id);
 update public.mwd_payment_requests set status='paid' where id=p_payment_id;
 return jsonb_build_object('status','ok','payment_id',p_payment_id,'transfer',v_result);
end $function$;

CREATE OR REPLACE FUNCTION public.mwd_transfer_demo(p_recipient_code text, p_amount_cents bigint, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_destination uuid;
  v_locked integer;
  v_balance bigint;
  v_destination_balance bigint;
  v_existing public.mwd_operations%rowtype;
  v_operation_id uuid;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion';
  end if;
  if p_request_id is null or p_amount_cents is null
    or p_amount_cents < 1 or p_amount_cents > 100000000 then
    raise exception 'Solicitud o cantidad invalida';
  end if;
  if p_recipient_code is null or char_length(btrim(p_recipient_code)) > 40 then
    raise exception 'Codigo de destino invalido';
  end if;

  select w.user_id into v_destination
  from public.mwd_wallets w
  where w.account_code = upper(btrim(p_recipient_code));
  if v_destination is null or v_destination = v_actor then
    raise exception 'Cuenta destinataria no disponible';
  end if;

  perform w.user_id from public.mwd_wallets w
  where w.user_id in (v_actor, v_destination)
  order by w.user_id for update;
  get diagnostics v_locked = row_count;
  if v_locked <> 2 then
    raise exception 'Cuenta de prueba no disponible';
  end if;

  select * into v_existing from public.mwd_operations o
  where o.actor_id = v_actor and o.request_id = p_request_id;
  if found then
    if v_existing.kind <> 'transfer' or v_existing.source_user_id <> v_actor
      or v_existing.destination_user_id <> v_destination
      or v_existing.amount_cents <> p_amount_cents then
      raise exception 'Identificador ya usado para otra operacion';
    end if;
    select w.balance_cents into v_balance from public.mwd_wallets w where w.user_id = v_actor;
    return jsonb_build_object('status', 'already_processed',
      'operation_id', v_existing.id, 'balance_cents', v_balance);
  end if;

  select w.balance_cents into v_balance from public.mwd_wallets w where w.user_id = v_actor;
  select w.balance_cents into v_destination_balance
    from public.mwd_wallets w where w.user_id = v_destination;
  if v_balance < p_amount_cents then
    raise exception 'Saldo ficticio insuficiente';
  end if;
  if v_destination_balance > 100000000000 - p_amount_cents then
    raise exception 'Limite de saldo ficticio alcanzado';
  end if;

  update public.mwd_wallets
    set balance_cents = balance_cents - p_amount_cents
    where user_id = v_actor;
  update public.mwd_wallets
    set balance_cents = balance_cents + p_amount_cents
    where user_id = v_destination;

  insert into public.mwd_operations
    (actor_id, request_id, kind, source_user_id, destination_user_id, amount_cents)
    values (v_actor, p_request_id, 'transfer', v_actor, v_destination, p_amount_cents)
    returning id into v_operation_id;

  return jsonb_build_object('status', 'ok',
    'operation_id', v_operation_id, 'balance_cents', v_balance - p_amount_cents);
end
$function$;

-- La seguridad de EXECUTE debe replicar las concesiones del backend.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 public.mwd_transfer_demo(text,bigint,uuid),
 public.mwd_contribute_demo(bigint,uuid),
 public.mwd_pay_merchant_demo(uuid),
 public.mwd_cancel_payment_request_demo(uuid),
 public.mwd_get_payment_request_demo(uuid),
 public.mwd_owner_summary_demo()
TO authenticated;

-- No se ejecutan migraciones sobre Supabase. Este esquema desaparece al salir de CI.
