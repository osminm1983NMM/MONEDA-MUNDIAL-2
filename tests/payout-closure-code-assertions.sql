-- Isolated PostgreSQL QA for DEMO-only closing with consumed code.
-- Extend CI's minimal mock catalog with Honduras (no production access).
INSERT INTO mwd_finance_private.world_country_catalog(country_code) VALUES ('HN');
SET request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.mwd_owner_complete_payout_sample_demo('00000000-0000-4000-8000-000000000000'::uuid,gen_random_uuid());
  RAISE EXCEPTION 'Non-owner was granted access';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$
DECLARE
 p uuid; l uuid; o uuid; token text; r jsonb; s jsonb;
BEGIN
 r:=public.mwd_owner_partner_save_demo('QA banco simulacion','bank','HN');
 p:=(r->>'id')::uuid;
 perform public.mwd_owner_partner_set_status_demo(p,'under_review');
 perform public.mwd_owner_partner_set_status_demo(p,'documented');
 r:=public.mwd_owner_partner_location_save_demo(p,'QA oficina','Tegucigalpa','HNL');
 l:=(r->>'id')::uuid;
 r:=public.mwd_owner_remittance_create_demo('HN',10000,gen_random_uuid());
 o:=(r->>'id')::uuid;
 perform public.mwd_owner_remittance_transition_demo(o,'review',gen_random_uuid());
 perform public.mwd_owner_assign_payout_design_demo(o,p,l,gen_random_uuid());
 perform public.mwd_owner_remittance_transition_demo(o,'simulated',gen_random_uuid());
 BEGIN
  PERFORM public.mwd_owner_complete_payout_sample_demo(o,gen_random_uuid());
  RAISE EXCEPTION 'Closure without code incorrectly accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 r:=public.mwd_owner_issue_pickup_code_demo(o,gen_random_uuid());
 token:=r->>'demo_code_once';
 BEGIN
  PERFORM public.mwd_owner_complete_payout_sample_demo(o,gen_random_uuid());
  RAISE EXCEPTION 'Closure with unconsumed code incorrectly accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 perform public.mwd_owner_mock_beneficiary_check_demo(o,gen_random_uuid());
 r:=public.mwd_owner_try_pickup_code_demo(o,token,gen_random_uuid());
 IF r->>'status'<>'consumed' or r->>'money_paid'<>'false' THEN
   RAISE EXCEPTION 'Invalid fake code consumption'; END IF;
 r:=public.mwd_owner_complete_payout_sample_demo(o,'66666666-6666-4666-8666-666666666666'::uuid);
 IF r->>'status'<>'sample_completed' or r->>'money_paid'<>'false' THEN
   RAISE EXCEPTION 'Valid DEMO closure failed'; END IF;
 s:=public.mwd_owner_complete_payout_sample_demo(o,'66666666-6666-4666-8666-666666666666'::uuid);
 IF s->>'already_processed'<>'true' THEN RAISE EXCEPTION 'Idempotency broken'; END IF;
 BEGIN
  PERFORM public.mwd_owner_complete_payout_sample_demo(o,gen_random_uuid());
  RAISE EXCEPTION 'Duplicate mock payout closure accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;
SELECT 'Mock payout closure requires consumed token, owner and idempotency' AS result;
