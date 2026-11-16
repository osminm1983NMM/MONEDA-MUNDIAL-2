-- Moneda Mundial 2.0: auditoria de pagos DEMO, solo lectura.
-- No modifica saldos ni estados. No habilita dinero real.
WITH matches AS (
 SELECT p.id, p.status, p.merchant_user_id, p.amount_cents,
   count(o.id) FILTER (WHERE o.destination_user_id=p.merchant_user_id AND o.amount_cents=p.amount_cents) AS matching_ops,
   count(o.id) AS total_ops_for_payment_id
 FROM public.mwd_payment_requests p
 LEFT JOIN public.mwd_operations o ON o.request_id=p.id
 GROUP BY p.id,p.status,p.merchant_user_id,p.amount_cents
)
SELECT count(*) AS payment_requests,
 count(*) FILTER (WHERE status='paid') AS paid_requests,
 count(*) FILTER (WHERE status='paid' AND matching_ops=0) AS paid_without_matching_operation,
 count(*) FILTER (WHERE status<>'paid' AND matching_ops>0) AS unpaid_with_matching_operation,
 count(*) FILTER (WHERE total_ops_for_payment_id>1) AS payment_ids_with_multiple_operations,
 count(*) FILTER (WHERE status='paid' AND matching_ops>1) AS paid_with_multiple_matching_operations
FROM matches;

-- Interpretacion: cero discrepancias es necesario, no suficiente para
-- garantizar ausencia de fraude, consistencia de balances o concurrencia segura.
