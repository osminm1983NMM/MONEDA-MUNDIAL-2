-- Integration tests in PostgreSQL 17 isolated CI, no user data or live remittances.
DO $test$
BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='mwd_partners_private.due_diligence_reviews'::regclass)
 THEN RAISE EXCEPTION 'RLS inactive'; END IF;
 IF has_schema_privilege('authenticated','mwd_partners_private','USAGE')
 OR has_table_privilege('authenticated','mwd_partners_private.due_diligence_reviews','SELECT')
 OR has_function_privilege('anon','public.mwd_owner_partner_due_diligence_demo(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Private metadata exposed'; END IF;
END $test$;
SET ROLE authenticated;
SET request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $test$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN PERFORM public.mwd_owner_partner_due_diligence_demo('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid);
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Ordinary user read review list';END IF;
 blocked:=false;
 BEGIN PERFORM public.mwd_owner_partner_due_diligence_save_demo(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'regulatory_license','reviewed_internal');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Ordinary user wrote review';END IF;
END $test$;
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $test$
DECLARE partner_id uuid; rs jsonb; n integer; v text; blocked boolean;
BEGIN
 rs:=public.mwd_owner_partner_save_demo('Banco ficticio cumplimiento','bank','NI');
 partner_id:=(rs->>'id')::uuid;
 SELECT count(*) INTO n FROM public.mwd_owner_partner_due_diligence_demo(partner_id);
 IF n<>10 THEN RAISE EXCEPTION 'Expected 10 requirements, found %',n;END IF;
 rs:=public.mwd_owner_partner_due_diligence_save_demo(partner_id,'regulatory_license','requested');
 IF rs->>'real_payouts_enabled'<>'false' OR rs->>'real_partners_approved'<>'false'
 THEN RAISE EXCEPTION 'Financial operation accidentally enabled';END IF;
 PERFORM public.mwd_owner_partner_due_diligence_save_demo(partner_id,'regulatory_license','received_unverified');
 PERFORM public.mwd_owner_partner_due_diligence_save_demo(partner_id,'signed_agreement','reviewed_internal');
 SELECT review_status INTO v FROM public.mwd_owner_partner_due_diligence_demo(partner_id)
 WHERE requirement_type='regulatory_license';
 IF v<>'received_unverified' THEN RAISE EXCEPTION 'Review did not persist';END IF;
 SELECT count(*) INTO n FROM public.mwd_owner_partner_audit_demo(partner_id)
 WHERE entity_type='due_diligence_reviews';
 IF n<>3 THEN RAISE EXCEPTION 'Expected 3 audited requirement writes, got %',n;END IF;
 blocked:=false;
 BEGIN PERFORM public.mwd_owner_partner_due_diligence_save_demo(partner_id,'password','reviewed_internal');
 EXCEPTION WHEN invalid_parameter_value THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Invalid requirement accepted';END IF;
 PERFORM public.mwd_owner_partner_set_status_demo(partner_id,'under_review');
 PERFORM public.mwd_owner_partner_set_status_demo(partner_id,'documented');
 PERFORM public.mwd_owner_partner_set_status_demo(partner_id,'archived');
 blocked:=false;
 BEGIN PERFORM public.mwd_owner_partner_due_diligence_save_demo(partner_id,'tax_reporting','requested');
 EXCEPTION WHEN invalid_parameter_value THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Archived candidate could be modified';END IF;
END $test$;
RESET ROLE;
RESET request.jwt.claim.sub;
DO $test$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM mwd_partners_private.due_diligence_reviews;
 IF n<>2 THEN RAISE EXCEPTION 'Expected 2 durable unique requirements';END IF;
 SELECT count(*) INTO n FROM mwd_partners_private.change_audit WHERE entity_type='due_diligence_reviews';
 IF n<>3 THEN RAISE EXCEPTION 'Audit events missing';END IF;
 RAISE NOTICE 'PASS owner-only durability, requirements, audit, archived lock, fake payouts disabled';
END $test$;
