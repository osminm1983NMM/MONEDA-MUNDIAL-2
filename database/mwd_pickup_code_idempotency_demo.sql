-- Ampliación segura de la prueba de códigos NO COBRABLES.
-- Requiere instalar database/mwd_beneficiary_code_security_demo.sql primero.
-- Los reintentos legados con huella NULL se rechazan (fallo cerrado).
alter table mwd_remittance_demo_private.pickup_code_attempts
  add column if not exists request_fingerprint text;
do $$
begin
 if not exists (select 1 from pg_constraint
   where conrelid='mwd_remittance_demo_private.pickup_code_attempts'::regclass
     and conname='mwd_demo_request_fingerprint_hex') then
   alter table mwd_remittance_demo_private.pickup_code_attempts
     add constraint mwd_demo_request_fingerprint_hex
     check(request_fingerprint is null or request_fingerprint ~ '^[0-9a-f]{64}$');
 end if;
end $$;
comment on column mwd_remittance_demo_private.pickup_code_attempts.request_fingerprint is
 'Hash del código de DEMO enlazado al UUID de intento; NULL histórico no se puede reintentar.';
create or replace function public.mwd_owner_try_pickup_code_demo(
 p_order_id uuid,p_demo_code text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid;
 v_sample mwd_remittance_demo_private.pickup_code_samples%rowtype;
 v_cached jsonb;
 v_cached_fingerprint text;
 v_fingerprint text;
 v_result jsonb;
 v_hash text;
 v_tries integer;
 v_new_status text;
begin
 v_actor:=mwd_remittance_demo_private.assert_owner();
 if p_order_id is null or p_request_id is null or
    (p_demo_code is not null and char_length(p_demo_code)>128) then
   raise exception 'Parámetros inválidos' using errcode='22023'; end if;
 -- Vincula cada UUID a los mismos bytes del código DEMO (sin guardarlos).
 v_fingerprint:=encode(sha256(convert_to(
   'mwd-pickup-demo-request-v2:'||
   case when p_demo_code is null then 'N:' else 'T:'||p_demo_code end,
   'UTF8')),'hex');
 select c.* into v_sample from mwd_remittance_demo_private.orders o
 join mwd_remittance_demo_private.payout_assignments a on a.order_id=o.id
 join mwd_remittance_demo_private.pickup_code_samples c on c.assignment_id=a.id
 where o.id=p_order_id for update of c;
 if not found then raise exception 'No existe código ficticio' using errcode='22023'; end if;
 -- FOR UPDATE serializa intentos concurrentes. Solo se recupera un mismo
 -- UUID si corresponde al mismo código; los intentos legados fallan cerrado.
 select a.result,a.request_fingerprint into v_cached,v_cached_fingerprint
 from mwd_remittance_demo_private.pickup_code_attempts a
 where a.sample_id=v_sample.id and a.request_id=p_request_id;
 if found then
   if v_cached_fingerprint is null or v_cached_fingerprint<>v_fingerprint then
     raise exception 'Clave de reintento reutilizada con datos distintos'
       using errcode='22023';
   end if;
   return v_cached || jsonb_build_object('already_processed',true);
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
   v_result:=jsonb_build_object('status',v_new_status,'accepted',false,
     'remaining_attempts',5-v_tries,'real_payments_enabled',false,'redeemable',false);
   insert into mwd_remittance_demo_private.pickup_code_attempts(sample_id,request_id,result,request_fingerprint)
   values(v_sample.id,p_request_id,v_result,v_fingerprint);
   return v_result;
 end if;
 if v_sample.identity_check_simulated_at is null then
   v_result:=jsonb_build_object('status','identity_demo_pending','accepted',false,
     'identity_real_verified',false,'real_payments_enabled',false,'redeemable',false);
   insert into mwd_remittance_demo_private.pickup_code_attempts(sample_id,request_id,result,request_fingerprint)
   values(v_sample.id,p_request_id,v_result,v_fingerprint);
   return v_result;
 end if;

 update mwd_remittance_demo_private.pickup_code_samples
 set status='consumed',consume_request_id=p_request_id,closed_at=now()
 where id=v_sample.id;
 insert into mwd_remittance_demo_private.pickup_code_events(sample_id,actor_id,action)
 values(v_sample.id,v_actor,'consumed');
 -- La simulación NO cambia el libro contable ni registra pagos de efectivo.
 v_result:=jsonb_build_object('status','consumed','accepted',true,
   'sample_completed',true,'identity_real_verified',false,
   'money_paid',false,'real_payments_enabled',false,'redeemable',false);
 insert into mwd_remittance_demo_private.pickup_code_attempts(sample_id,request_id,result,request_fingerprint)
 values(v_sample.id,p_request_id,v_result,v_fingerprint);
 return v_result;
end; $$;
revoke all on function public.mwd_owner_try_pickup_code_demo(uuid,text,uuid)
 from public,anon,authenticated;
grant execute on function public.mwd_owner_try_pickup_code_demo(uuid,text,uuid)
 to authenticated;
