-- Candidate: rehearse before deployment; preserve existing view interface.
begin;
create or replace view mwd_finance_private.demo_ledger_alerts_v1 with (security_invoker=true) as
select o.id as operation_id, case when t.id is null then 'missing_ledger' when t.status <> 'posted' then 'not_posted' when count(e.id) <> 2 then 'wrong_entry_count' when coalesce(sum(e.amount_minor) filter(where e.entry_side='debit'),0) <> o.amount_cents or coalesce(sum(e.amount_minor) filter(where e.entry_side='credit'),0) <> o.amount_cents then 'amount_mismatch' else 'ok' end as alert_status
from public.mwd_operations o left join mwd_finance_private.ledger_transactions t on t.external_reference=(case when o.kind='transfer' then 'mwd-demo-transfer:' else 'mwd-demo-contribution:' end)||o.id::text left join mwd_finance_private.ledger_entries e on e.transaction_id=t.id where o.kind in ('transfer','contribution') group by o.id,o.amount_cents,t.id,t.status;
revoke all on mwd_finance_private.demo_ledger_alerts_v1 from public,anon,authenticated;
select alert_status,count(*) from mwd_finance_private.demo_ledger_alerts_v1 group by alert_status;
rollback;
