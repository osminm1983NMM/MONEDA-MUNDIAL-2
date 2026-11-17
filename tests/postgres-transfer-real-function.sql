\set ON_ERROR_STOP on
-- Snapshot of current mwd_transfer_demo, inspected read-only on 2026-11-16.
CREATE OR REPLACE FUNCTION public.mwd_transfer_demo(p_recipient_code text,p_amount_cents bigint,p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
 v_actor uuid := auth.uid(); v_destination uuid; v_locked integer; v_balance bigint; v_destination_balance bigint; v_existing public.mwd_operations%rowtype; v_operation_id uuid;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesion'; END IF;
 IF p_request_id IS NULL OR p_amount_cents IS NULL OR p_amount_cents<1 OR p_amount_cents>100000000 THEN RAISE EXCEPTION 'Solicitud o cantidad invalida'; END IF;
 IF p_recipient_code IS NULL OR char_length(btrim(p_recipient_code))>40 THEN RAISE EXCEPTION 'Codigo de destino invalido'; END IF;
 SELECT w.user_id INTO v_destination FROM public.mwd_wallets w WHERE w.account_code=upper(btrim(p_recipient_code));
 IF v_destination IS NULL OR v_destination=v_actor THEN RAISE EXCEPTION 'Cuenta destinataria no disponible'; END IF;
 PERFORM w.user_id FROM public.mwd_wallets w WHERE w.user_id IN (v_actor,v_destination) ORDER BY w.user_id FOR UPDATE;
 GET DIAGNOSTICS v_locked=ROW_COUNT;
 IF v_locked<>2 THEN RAISE EXCEPTION 'Cuenta de prueba no disponible'; END IF;
 SELECT * INTO v_existing FROM public.mwd_operations o WHERE o.actor_id=v_actor AND o.request_id=p_request_id;
 IF FOUND THEN
  IF v_existing.kind<>'transfer' OR v_existing.source_user_id<>v_actor OR v_existing.destination_user_id<>v_destination OR v_existing.amount_cents<>p_amount_cents THEN RAISE EXCEPTION 'Identificador ya usado para otra operacion'; END IF;
  SELECT w.balance_cents INTO v_balance FROM public.mwd_wallets w WHERE w.user_id=v_actor;
  RETURN jsonb_build_object('status','already_processed','operation_id',v_existing.id,'balance_cents',v_balance);
 END IF;
 SELECT w.balance_cents INTO v_balance FROM public.mwd_wallets w WHERE w.user_id=v_actor;
 SELECT w.balance_cents INTO v_destination_balance FROM public.mwd_wallets w WHERE w.user_id=v_destination;
 IF v_balance<p_amount_cents THEN RAISE EXCEPTION 'Saldo ficticio insuficiente'; END IF;
 IF v_destination_balance>100000000000-p_amount_cents THEN RAISE EXCEPTION 'Limite de saldo ficticio alcanzado'; END IF;
 UPDATE public.mwd_wallets SET balance_cents=balance_cents-p_amount_cents WHERE user_id=v_actor;
 UPDATE public.mwd_wallets SET balance_cents=balance_cents+p_amount_cents WHERE user_id=v_destination;
 INSERT INTO public.mwd_operations(actor_id,request_id,kind,source_user_id,destination_user_id,amount_cents) VALUES(v_actor,p_request_id,'transfer',v_actor,v_destination,p_amount_cents) RETURNING id INTO v_operation_id;
 RETURN jsonb_build_object('status','ok','operation_id',v_operation_id,'balance_cents',v_balance-p_amount_cents);
END
$fn$;
