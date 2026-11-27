-- DEMO read-only inventory guard, baseline 2026-11-26.
-- Intentional additions/removals require explicit review of privileges and authorization.
-- Structural inventory is not proof of ownership checks in a function body.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
DO $gate$
DECLARE
 expected constant text[]:=ARRAY[
  'mwd_agent_my_scope_demo()',
  'mwd_cancel_payment_request_demo(uuid)',
  'mwd_contribute_demo(bigint, uuid)',
  'mwd_conversion_confirm_demo(uuid)',
  'mwd_conversion_quote_demo(text, bigint, uuid)',
  'mwd_conversion_reconcile_demo(uuid)',
  'mwd_conversion_wallet_demo()',
  'mwd_get_payment_request_demo(uuid)',
  'mwd_history_demo()',
  'mwd_operation_status_demo(uuid)',
  'mwd_owner_accounting_alerts_demo()',
  'mwd_owner_agent_access_demo(uuid, uuid, text, text, integer)',
  'mwd_owner_agent_audit_demo()',
  'mwd_owner_agent_list_demo()',
  'mwd_owner_assign_payout_design_demo(uuid, uuid, uuid, uuid)',
  'mwd_owner_cancel_pickup_code_demo(uuid)',
  'mwd_owner_complete_payout_sample_demo(uuid, uuid)',
  'mwd_owner_conversion_dashboard_demo()',
  'mwd_owner_conversion_policy_demo(boolean, numeric, integer, text, timestamp with time zone)',
  'mwd_owner_demo_fee_catalog()',
  'mwd_owner_issue_pickup_code_demo(uuid, uuid)',
  'mwd_owner_mock_beneficiary_check_demo(uuid, uuid)',
  'mwd_owner_partner_audit_demo(uuid)',
  'mwd_owner_partner_audit_feed_demo(text, uuid, integer)',
  'mwd_owner_partner_due_diligence_demo(uuid)',
  'mwd_owner_partner_due_diligence_save_demo(uuid, text, text, date)',
  'mwd_owner_partner_engagement_demo(uuid)',
  'mwd_owner_partner_engagement_save_demo(uuid, text, date)',
  'mwd_owner_partner_expiry_dashboard_demo(integer)',
  'mwd_owner_partner_location_save_demo(uuid, text, text, text, text, uuid)',
  'mwd_owner_partner_locations_demo(uuid)',
  'mwd_owner_partner_readiness_overview_demo(text)',
  'mwd_owner_partner_save_demo(text, text, text, uuid)',
  'mwd_owner_partner_set_status_demo(uuid, text)',
  'mwd_owner_partners_demo()',
  'mwd_owner_payout_design_summary_demo(uuid)',
  'mwd_owner_pickup_code_summary_demo(uuid)',
  'mwd_owner_pickup_orders_demo()',
  'mwd_owner_pickup_security_demo()',
  'mwd_owner_pickup_simulate_demo(uuid, text)',
  'mwd_owner_remittance_create_demo(text, bigint, uuid)',
  'mwd_owner_remittance_events_demo(uuid)',
  'mwd_owner_remittance_monitor_demo(text, integer)',
  'mwd_owner_remittance_transition_demo(uuid, text, uuid)',
  'mwd_owner_remittances_demo()',
  'mwd_owner_summary_demo()',
  'mwd_owner_try_pickup_code_demo(uuid, text, uuid)',
  'mwd_owner_update_demo_fee(text, integer, bigint)',
  'mwd_pay_merchant_demo(uuid)',
  'mwd_pending_recipient_check_demo(uuid, text)',
  'mwd_pickup_cancel_demo(uuid)',
  'mwd_pickup_create_demo(text, bigint, uuid)',
  'mwd_pickup_my_orders_demo()',
  'mwd_quote_international_demo(text, bigint, text)',
  'mwd_transfer_demo(text, bigint, uuid)',
  'mwd_world_countries_demo()'
 ];
 actual text[];
 added text[];
 removed text[];
BEGIN
 SELECT coalesce(array_agg(p.proname||'('||oidvectortypes(p.proargtypes)||')' ORDER BY p.proname||'('||oidvectortypes(p.proargtypes)||')'),ARRAY[]::text[])
 INTO actual FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'mwd_%' AND p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE');
 SELECT coalesce(array_agg(x ORDER BY x),ARRAY[]::text[]) INTO added FROM (SELECT unnest(actual) AS x EXCEPT SELECT unnest(expected)) d;
 SELECT coalesce(array_agg(x ORDER BY x),ARRAY[]::text[]) INTO removed FROM (SELECT unnest(expected) AS x EXCEPT SELECT unnest(actual)) d;
 IF cardinality(added)<>0 OR cardinality(removed)<>0 THEN
  RAISE EXCEPTION 'Privileged MWD RPC inventory changed; added %, removed %',added,removed;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND ((n.nspname='public' AND p.proname LIKE 'mwd_%') OR n.nspname LIKE 'mwd%private') AND (has_function_privilege('anon',p.oid,'EXECUTE') OR NOT coalesce(p.proconfig @> ARRAY['search_path=""'],false) OR (n.nspname LIKE 'mwd%private' AND has_function_privilege('authenticated',p.oid,'EXECUTE')))) THEN
  RAISE EXCEPTION 'Unexpected privileged function access or search_path';
 END IF;
END $gate$;
SELECT count(*) AS authenticated_public_privileged_rpcs, count(*) FILTER (WHERE p.proname LIKE 'mwd_owner_%') AS owner_rpcs
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'mwd_%' AND p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE');
ROLLBACK;
