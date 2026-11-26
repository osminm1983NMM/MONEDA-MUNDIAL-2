-- Isolated synthetic fixture only. All changes rolled back, even on success.
BEGIN;
DO $gate$
DECLARE
 a constant uuid:='f1a00000-0000-4000-8000-000000000001';
 b constant uuid:='f1a00000-0000-4000-8000-000000000002';
 paid_id uuid:=gen_random_uuid(); cancel_id uuid:=gen_random_uuid();
 invalid_id uuid:=gen_random_uuid(); amount constant bigint:=100;
 before_a bigint; before_b bigint; x jsonb; rejected boolean; affected integer;
BEGIN
 IF current_database()<>'mwd_demo_isolated' OR
  (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database())
    IS DISTINCT FROM 'MWD_DISPOSABLE_CONCURRENCY_TEST_ONLY'
 THEN RAISE EXCEPTION 'Refusing non-disposable database'; END IF;
 IF (SELECT count(*) FROM auth.users)<>2 OR
    (SELECT count(*) FROM public.mwd_wallets WHERE user_id IN(a,b))<>2 OR
    EXISTS(SELECT 1 FROM public.mwd_merchants) OR EXISTS(SELECT 1 FROM public.mwd_payment_requests)
 THEN RAISE EXCEPTION 'Expected two synthetic accounts and empty merchant tables'; END IF;
 IF EXISTS(SELECT 1 FROM mwd_finance_private.demo_fee_routes WHERE real_payments_enabled IS DISTINCT FROM false)
 THEN RAISE EXCEPTION 'Real payment route enabled'; END IF;
 IF has_table_privilege('anon','public.mwd_merchants','SELECT')
 OR has_any_column_privilege('anon','public.mwd_merchants','SELECT')
 OR has_table_privilege('anon','public.mwd_payment_requests','SELECT')
 OR has_any_column_privilege('anon','public.mwd_payment_requests','SELECT')
 OR has_function_privilege('anon','public.mwd_get_payment_request_demo(uuid)','EXECUTE')
 OR has_function_privilege('anon','public.mwd_pay_merchant_demo(uuid)','EXECUTE')
 OR has_function_privilege('anon','public.mwd_cancel_payment_request_demo(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous merchant access'; END IF;
 SELECT balance_cents INTO before_a FROM public.mwd_wallets WHERE user_id=a;
 SELECT balance_cents INTO before_b FROM public.mwd_wallets WHERE user_id=b;
 IF before_a<amount THEN RAISE EXCEPTION 'Insufficient synthetic balance'; END IF;
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 INSERT INTO public.mwd_merchants(owner_user_id,business_name,country_code)
 VALUES(b,'Synthetic LAB merchant','HN');
 INSERT INTO public.mwd_payment_requests(id,merchant_user_id,amount_cents)
 VALUES(paid_id,b,amount),(cancel_id,b,amount);
 rejected:=false;
 BEGIN
   INSERT INTO public.mwd_payment_requests(id,merchant_user_id,amount_cents,currency_code)
   VALUES(invalid_id,b,amount,'USD');
 EXCEPTION WHEN check_violation OR insufficient_privilege THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Non-MWD request accepted'; END IF;
 -- Even the merchant cannot fabricate a paid request or edit its payment status directly.
 rejected:=false;
 BEGIN
   INSERT INTO public.mwd_payment_requests(id,merchant_user_id,amount_cents,status)
   VALUES(invalid_id,b,amount,'paid');
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Prepaid request inserted'; END IF;
 rejected:=false;
 BEGIN
   UPDATE public.mwd_payment_requests SET status='paid' WHERE id=paid_id;
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Direct merchant status mutation accepted'; END IF;
 rejected:=false;
 BEGIN
   UPDATE public.mwd_merchants SET created_at=now() WHERE owner_user_id=b;
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Merchant metadata mutation accepted'; END IF;
 rejected:=false;
 BEGIN
   PERFORM public.mwd_pay_merchant_demo(paid_id);
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE '%pagarte a ti mismo%' THEN RAISE; END IF;
   rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Self-payment accepted'; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 -- A payer may use the narrow quote RPC but cannot list or modify another merchant's records.
 IF EXISTS(SELECT 1 FROM public.mwd_merchants WHERE owner_user_id=b)
 OR EXISTS(SELECT 1 FROM public.mwd_payment_requests WHERE id IN(paid_id,cancel_id))
 THEN RAISE EXCEPTION 'Foreign merchant or request visible via table'; END IF;
 UPDATE public.mwd_merchants SET business_name='Unauthorized edit' WHERE owner_user_id=b;
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Foreign merchant updated'; END IF;
 rejected:=false;
 BEGIN
   INSERT INTO public.mwd_payment_requests(id,merchant_user_id,amount_cents)
   VALUES(invalid_id,b,amount);
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Foreign merchant request inserted'; END IF;
 x:=public.mwd_get_payment_request_demo(paid_id);
 IF x->>'status' IS DISTINCT FROM 'pending' OR x->>'currency_code' IS DISTINCT FROM 'MWD'
 OR (x->>'amount_cents')::bigint IS DISTINCT FROM amount THEN RAISE EXCEPTION 'Quote mismatch'; END IF;
 rejected:=false;
 BEGIN
   PERFORM public.mwd_cancel_payment_request_demo(paid_id);
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE '%Solicitud no disponible%' THEN RAISE; END IF;
   rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Foreign cancellation accepted'; END IF;
 IF public.mwd_pay_merchant_demo(paid_id)->>'status' IS DISTINCT FROM 'ok'
 THEN RAISE EXCEPTION 'Payment failed'; END IF;
 IF public.mwd_pay_merchant_demo(paid_id)->>'status' IS DISTINCT FROM 'already_processed'
 THEN RAISE EXCEPTION 'Payment retry failed'; END IF;
 RESET ROLE;
 IF (SELECT balance_cents FROM public.mwd_wallets WHERE user_id=a) IS DISTINCT FROM before_a-amount OR
    (SELECT balance_cents FROM public.mwd_wallets WHERE user_id=b) IS DISTINCT FROM before_b+amount
 THEN RAISE EXCEPTION 'Payment balances do not reconcile'; END IF;
 IF (SELECT count(*) FROM public.mwd_operations WHERE actor_id=a AND request_id=paid_id
     AND destination_user_id=b AND amount_cents=amount)<>1 OR
    (SELECT count(*) FROM public.mwd_operations WHERE request_id=paid_id)<>1 OR
    (SELECT status FROM public.mwd_payment_requests WHERE id=paid_id) IS DISTINCT FROM 'paid'
 THEN RAISE EXCEPTION 'Payment operation or state mismatch'; END IF;
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 IF public.mwd_cancel_payment_request_demo(cancel_id)->>'status' IS DISTINCT FROM 'cancelled'
 OR public.mwd_cancel_payment_request_demo(cancel_id)->>'status' IS DISTINCT FROM 'cancelled'
 THEN RAISE EXCEPTION 'Cancellation retry mismatch'; END IF;
 rejected:=false;
 BEGIN
   PERFORM public.mwd_cancel_payment_request_demo(paid_id);
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE '%No se puede cancelar un pago realizado%' THEN RAISE; END IF;
   rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Paid request cancelled'; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 rejected:=false;
 BEGIN
   PERFORM public.mwd_pay_merchant_demo(cancel_id);
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE '%Solicitud no disponible%' THEN RAISE; END IF;
   rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cancelled request paid'; END IF;
 RESET ROLE;
 IF EXISTS(SELECT 1 FROM public.mwd_operations WHERE request_id IN(cancel_id,invalid_id))
 OR (SELECT balance_cents FROM public.mwd_wallets WHERE user_id=a) IS DISTINCT FROM before_a-amount
 OR (SELECT balance_cents FROM public.mwd_wallets WHERE user_id=b) IS DISTINCT FROM before_b+amount
 THEN RAISE EXCEPTION 'Rejected payment changed balances or ledger'; END IF;
 -- Verify the actual commercial posting before rollback: the later global
 -- accounting gates cannot see an operation rolled back by this test.
 IF NOT EXISTS (
   SELECT o.id
   FROM public.mwd_operations o
   LEFT JOIN mwd_finance_private.ledger_transactions t
     ON t.external_reference='mwd-demo-transfer:'||o.id::text
   LEFT JOIN mwd_finance_private.ledger_entries e ON e.transaction_id=t.id
   LEFT JOIN mwd_finance_private.ledger_accounts la ON la.id=e.account_id
   WHERE o.actor_id=a AND o.source_user_id=a AND o.destination_user_id=b
     AND o.request_id=paid_id AND o.kind='transfer' AND o.amount_cents=amount
   GROUP BY o.id
   HAVING count(DISTINCT t.id)=1 AND count(e.id)=2
     AND bool_and(t.status='posted' AND t.currency_code='MWD' AND t.transaction_kind='wallet_transfer')
     AND count(*) FILTER (WHERE e.entry_side='debit' AND e.amount_minor=amount
       AND la.owner_user_id=a AND la.currency_code='MWD' AND la.account_type='customer_liability'
       AND la.account_code='MWD-DEMO-USER-'||a::text)=1
     AND count(*) FILTER (WHERE e.entry_side='credit' AND e.amount_minor=amount
       AND la.owner_user_id=b AND la.currency_code='MWD' AND la.account_type='customer_liability'
       AND la.account_code='MWD-DEMO-USER-'||b::text)=1
 ) THEN RAISE EXCEPTION 'Merchant payment posting missing or incorrect'; END IF;
 RAISE NOTICE 'PASS merchant functional: anonymous access, RLS, direct mutation denial, currency, self-pay, ownership, payment retry, exact ledger accounts, balances and cancellation';
END $gate$;
ROLLBACK;
