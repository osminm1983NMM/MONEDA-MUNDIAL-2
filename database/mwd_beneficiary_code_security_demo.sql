-- MONEDA MUNDIAL 2.0 | simulador de verificación de beneficiario y código
-- SOLO DEMOSTRACIÓN: ningún usuario, banco ni beneficiario puede cobrar dinero.
-- Requiere mwd_owner_remittance_tracking_demo.sql + mwd_payout_candidate_link_demo.sql.
-- La "verificación" es un ensayo de proceso; NO comprueba identidades reales.
-- Jamás almacena nombres, imágenes de documentos, identificaciones, PIN ni códigos en claro.

create table if not exists mwd_remittance_demo_private.pickup_code_samples (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null unique
   references mwd_remittance_demo_private.payout_assignments(id) on delete restrict,
 token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
 issue_request_id uuid not null unique,
 created_by uuid not null references auth.users(id),
 status text not null default 'active' check
   (status in ('active','cancelled','expired','locked','consumed')),
 failed_attempts integer not null default 0 check(failed_attempts between 0 and 5),
 identity_check_simulated_at timestamptz,
 identity_check_request_id uuid unique,
 consume_request_id uuid unique,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 closed_at timestamptz,
 check(expires_at>created_at),
 check((status='active' and closed_at is null) or
       (status<>'active' and closed_at is not null)),
 check((status='consumed' and consume_request_id is not null) or
       (status<>'consumed' and consume_request_id is null))
);
comment on table mwd_remittance_demo_private.pickup_code_samples is
 'Códigos DEMO NO COBRABLES. Hash solamente, vencimiento, 5 intentos, estado único. Identidad únicamente simulada.';
create index if not exists mwd_pickup_demo_status_expiry
 on mwd_remittance_demo_private.pickup_code_samples(status,expires_at);

create table if not exists mwd_remittance_demo_private.pickup_code_events (
 id bigint generated always as identity primary key,
 sample_id uuid not null references mwd_remittance_demo_private.pickup_code_samples(id) on delete restrict,
 actor_id uuid not null references auth.users(id),
 action text not null check(action in (
   'issued','mock_identity_checked','wrong_code','locked','expired','cancelled','consumed')),
 created_at timestamptz not null default clock_timestamp()
);
comment on table mwd_remittance_demo_private.pickup_code_events is
 'Auditoría sin códigos, nombres ni documentos. No constituye identidad o pago real.';
create index if not exists mwd_pickup_demo_events_sample
 on mwd_remittance_demo_private.pickup_code_events(sample_id,id);

alter table mwd_remittance_demo_private.pickup_code_samples enable row level security;
alter table mwd_remittance_demo_private.pickup_code_events enable row level security;
revoke all on mwd_remittance_demo_private.pickup_code_samples,
 mwd_remittance_demo_private.pickup_code_events from public,anon,authenticated;
revoke all on all sequences in schema mwd_remittance_demo_private from public,anon,authenticated;

-- Devuelve el código NO COBRABLE únicamente en la creación; no se guarda en claro.
-- Se usa el generador criptográfico de UUIDv4 de PostgreSQL (122 bits aleatorios)
-- y sha256 nativo; esto es una muestra técnica, NO un código para producción.
create or replace function public.mwd_owner_issue_pickup_code_demo(
 p_order_id uuid, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid;
 v_order mwd_remittance_demo_private.orders%rowtype;
 v_assignment mwd_remittance_demo_private.payout_assignments%rowtype;
 v_existing mwd_remittance_demo_private.pickup_code_samples%rowtype;
 v_id uuid;
 v_token text;
begin
 v_actor:=mwd_remittance_demo_private.assert_owner();
 if p_order_id is null or p_request_id is null then
   raise exception 'Parámetros inválidos' using errcode='22023';
 end if;
 select * into v_order from mwd_remittance_demo_private.orders
 where id=p_order_id for update;
 if not found then raise exception 'Remesa ficticia inexistente' using errcode='22023'; end if;
 select * into v_assignment from mwd_remittance_demo_private.payout_assignments
 where order_id=p_order_id for update;
 if not found or v_assignment.status<>'planned' or v_order.status<>'simulated'
 then raise exception 'Se requiere una remesa simulada y sucursal candidata pendiente'
 using errcode='22023'; end if;
 select * into v_existing from mwd_remittance_demo_private.pickup_code_samples
 where assignment_id=v_assignment.id for update;
 if found then
   if v_existing.issue_request_id=p_request_id then
     -- Nunca se vuelve a revelar el secreto al reintentar.
     return jsonb_build_object('id',v_existing.id,'status',v_existing.status,
       'already_processed',true,'code','NOT_REISSUED',
       'real_payments_enabled',false,'redeemable',false);
   end if;
   raise exception 'Ya existe un código de muestra; no puede regenerarse'
     using errcode='22023';
 end if;

 v_token:='DEMO-'||upper(replace(gen_random_uuid()::text,'-',''));
 insert into mwd_remittance_demo_private.pickup_code_samples
   (assignment_id,token_sha256,issue_request_id,created_by,expires_at)
 values (v_assignment.id,
   encode(sha256(convert_to('mwd-pickup-demo-v1:'||v_token,'UTF8')),'hex'),
   p_request_id,v_actor,now()+interval '30 minutes')
 returning id into v_id;
 insert into mwd_remittance_demo_private.pickup_code_events(sample_id,actor_id,action)
 values (v_id,v_actor,'issued');
 return jsonb_build_object('id',v_id,'status','active',
   'demo_code_once',v_token,'expires_in_minutes',30,
   'real_payments_enabled',false,'redeemable',false);
end; $$;

-- Esta operación representa solamente "verificación de identidad de prueba",
-- NO acepta, guarda ni valida documentos de beneficiarios reales.
create or replace function public.mwd_owner_mock_beneficiary_check_demo(
 p_order_id uuid,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid;
 v_sample mwd_remittance_demo_private.pickup_code_samples%rowtype;
begin
 v_actor:=mwd_remittance_demo_private.assert_owner();
 if p_order_id is null or p_request_id is null then
   raise exception 'Parámetros inválidos' using errcode='22023'; end if;
 select c.* into v_sample from mwd_remittance_demo_private.orders o
 join mwd_remittance_demo_private.payout_assignments a on a.order_id=o.id
 join mwd_remittance_demo_private.pickup_code_samples c on c.assignment_id=a.id
 where o.id=p_order_id for update of c;
 if not found then raise exception 'Código ficticio inexistente' using errcode='22023'; end if;
 if v_sample.identity_check_request_id=p_request_id
 then return jsonb_build_object('status',v_sample.status,'already_processed',true,
    'identity_real_verified',false,'identity_check_simulated',true,
    'real_payments_enabled',false,'redeemable',false); end if;
 if v_sample.status<>'active' or now()>=v_sample.expires_at then
   raise exception 'Código ficticio vencido o bloqueado' using errcode='22023'; end if;
 if v_sample.identity_check_simulated_at is not null then
   raise exception 'La comprobación ficticia ya se realizó' using errcode='22023'; end if;
 update mwd_remittance_demo_private.pickup_code_samples
 set identity_check_simulated_at=now(),identity_check_request_id=p_request_id
 where id=v_sample.id;
 insert into mwd_remittance_demo_private.pickup_code_events(sample_id,actor_id,action)
 values(v_sample.id,v_actor,'mock_identity_checked');
 return jsonb_build_object('status','active','identity_check_simulated',true,
   'identity_real_verified',false,'real_payments_enabled',false,'redeemable',false);
end; $$;

-- Un intento incorrecto debe devolver resultado, no lanzar excepción,
-- porque un RAISE EXCEPTION revertiría el contador de intentos.
create or replace function public.mwd_owner_try_pickup_code_demo(
 p_order_id uuid,p_demo_code text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid;
 v_sample mwd_remittance_demo_private.pickup_code_samples%rowtype;
 v_hash text;
 v_tries integer;
 v_new_status text;
begin
 v_actor:=mwd_remittance_demo_private.assert_owner();
 if p_order_id is null or p_request_id is null then
   raise exception 'Parámetros inválidos' using errcode='22023'; end if;
 select c.* into v_sample from mwd_remittance_demo_private.orders o
 join mwd_remittance_demo_private.payout_assignments a on a.order_id=o.id
 join mwd_remittance_demo_private.pickup_code_samples c on c.assignment_id=a.id
 where o.id=p_order_id for update of c;
 if not found then raise exception 'No existe código ficticio' using errcode='22023'; end if;
 if v_sample.status='consumed' and v_sample.consume_request_id=p_request_id then
   return jsonb_build_object('status','consumed','already_processed',true,
     'sample_completed',true,'money_paid',false,'real_payments_enabled',false,
     'redeemable',false);
 end if;
 if v_sample.status<>'active' then
   return jsonb_build_object('status',v_sample.status,'accepted',false,
     'real_payments_enabled',false,'redeemable',false);
 end if;
 if now()>=v_sample.expires_at then
   update mwd_remittance_demo_private.pickup_code_samples
   set status='expired',closed_at=now() where id=v_sample.id;
   insert into mwd_remittance_demo_private.pickup_code_events(sample_id,actor_id,action)
   values(v_sample.id,v_actor,'expired');
   return jsonb_build_object('status','expired','accepted',false,
     'real_payments_enabled',false,'redeemable',false);
 end if;

 -- Se compara sólo en servidor, sin exponer hash ni código almacenado.
 if p_demo_code is null or p_demo_code !~ '^DEMO-[0-9A-F]{32}$' then
   v_hash:=null;
 else
   v_hash:=encode(sha256(convert_to('mwd-pickup-demo-v1:'||p_demo_code,'UTF8')),'hex');
 end if;
 if v_hash is distinct from v_sample.token_sha256 then
   v_tries:=v_sample.failed_attempts+1;
   v_new_status:=case when v_tries>=5 then 'locked' else 'active' end;
   update mwd_remittance_demo_private.pickup_code_samples
   set failed_attempts=v_tries,status=v_new_status,
       closed_at=case when v_new_status='locked' then now() else null end
   where id=v_sample.id;
   insert into mwd_remittance_demo_private.pickup_code_events(sample_id,actor_id,action)
   values(v_sample.id,v_actor,'wrong_code');
   if v_new_status='locked' then
     insert into mwd_remittance_demo_private.pickup_code_events(sample_id,actor_id,action)
     values(v_sample.id,v_actor,'locked');
   end if;
   return jsonb_build_object('status',v_new_status,'accepted',false,
     'remaining_attempts',5-v_tries,'real_payments_enabled',false,'redeemable',false);
 end if;
 if v_sample.identity_check_simulated_at is null then
   return jsonb_build_object('status','identity_demo_pending','accepted',false,
     'identity_real_verified',false,'real_payments_enabled',false,'redeemable',false);
 end if;

 update mwd_remittance_demo_private.pickup_code_samples
 set status='consumed',consume_request_id=p_request_id,closed_at=now()
 where id=v_sample.id;
 insert into mwd_remittance_demo_private.pickup_code_events(sample_id,actor_id,action)
 values(v_sample.id,v_actor,'consumed');
 -- La simulación NO cambia el libro contable ni registra pagos de efectivo.
 return jsonb_build_object('status','consumed','accepted',true,
   'sample_completed',true,'identity_real_verified',false,
   'money_paid',false,'real_payments_enabled',false,'redeemable',false);
end; $$;

create or replace function public.mwd_owner_cancel_pickup_code_demo(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_sample mwd_remittance_demo_private.pickup_code_samples%rowtype;
begin
 v_actor:=mwd_remittance_demo_private.assert_owner();
 if p_order_id is null then raise exception 'Orden requerida' using errcode='22023'; end if;
 select c.* into v_sample from mwd_remittance_demo_private.orders o
 join mwd_remittance_demo_private.payout_assignments a on a.order_id=o.id
 join mwd_remittance_demo_private.pickup_code_samples c on c.assignment_id=a.id
 where o.id=p_order_id for update of c;
 if not found then raise exception 'No hay código de prueba' using errcode='22023'; end if;
 if v_sample.status='cancelled' then
    return jsonb_build_object('status','cancelled','already_processed',true,
     'real_payments_enabled',false,'redeemable',false); end if;
 if v_sample.status<>'active' then
    raise exception 'No se puede cancelar un código cerrado' using errcode='22023'; end if;
 update mwd_remittance_demo_private.pickup_code_samples
 set status='cancelled',closed_at=now() where id=v_sample.id;
 insert into mwd_remittance_demo_private.pickup_code_events(sample_id,actor_id,action)
 values(v_sample.id,v_actor,'cancelled');
 return jsonb_build_object('status','cancelled','real_payments_enabled',false,'redeemable',false);
end; $$;

create or replace function public.mwd_owner_pickup_code_summary_demo(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 perform mwd_remittance_demo_private.assert_owner();
 if p_order_id is null or not exists(
   select 1 from mwd_remittance_demo_private.orders where id=p_order_id
 ) then raise exception 'Remesa ficticia inexistente' using errcode='22023'; end if;
 select jsonb_build_object(
    'id',c.id,'status',case when c.status='active' and now()>=c.expires_at
      then 'expired' else c.status end,
    'expires_at',c.expires_at,
    'remaining_attempts',5-c.failed_attempts,
    'identity_check_simulated',c.identity_check_simulated_at is not null,
    'identity_real_verified',false,'money_paid',false,
    'real_payments_enabled',false,'redeemable',false,
    'events',(select count(*) from mwd_remittance_demo_private.pickup_code_events e
              where e.sample_id=c.id)
 ) into v_result
 from mwd_remittance_demo_private.orders o
 join mwd_remittance_demo_private.payout_assignments a on a.order_id=o.id
 join mwd_remittance_demo_private.pickup_code_samples c on c.assignment_id=a.id
 where o.id=p_order_id;
 return coalesce(v_result,jsonb_build_object('status','not_issued',
   'identity_real_verified',false,'real_payments_enabled',false,'redeemable',false));
end; $$;

revoke all on function public.mwd_owner_issue_pickup_code_demo(uuid,uuid)
 from public,anon,authenticated;
revoke all on function public.mwd_owner_mock_beneficiary_check_demo(uuid,uuid)
 from public,anon,authenticated;
revoke all on function public.mwd_owner_try_pickup_code_demo(uuid,text,uuid)
 from public,anon,authenticated;
revoke all on function public.mwd_owner_cancel_pickup_code_demo(uuid)
 from public,anon,authenticated;
revoke all on function public.mwd_owner_pickup_code_summary_demo(uuid)
 from public,anon,authenticated;
grant execute on function public.mwd_owner_issue_pickup_code_demo(uuid,uuid) to authenticated;
grant execute on function public.mwd_owner_mock_beneficiary_check_demo(uuid,uuid) to authenticated;
grant execute on function public.mwd_owner_try_pickup_code_demo(uuid,text,uuid) to authenticated;
grant execute on function public.mwd_owner_cancel_pickup_code_demo(uuid) to authenticated;
grant execute on function public.mwd_owner_pickup_code_summary_demo(uuid) to authenticated;
