-- PostgreSQL aislado exclusivamente. Se prepara después del expediente de socios.
SET ROLE authenticated;
SET request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM public.mwd_owner_partner_expiry_dashboard_demo(60);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Nonowner access to expiry dashboard'; END IF;
END $$;
RESET ROLE;
SET request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
DO $$
DECLARE p uuid; n integer; level text; ans jsonb;
BEGIN
 ans:=public.mwd_owner_partner_save_demo('Banco ficticio fechas','bank','NI');
 p:=(ans->>'id')::uuid;
 PERFORM public.mwd_owner_partner_due_diligence_save_demo(p,'regulatory_license','requested',current_date-1);
 PERFORM public.mwd_owner_partner_due_diligence_save_demo(p,'signed_agreement','received_unverified',current_date+45);
 PERFORM public.mwd_owner_partner_due_diligence_save_demo(p,'jurisdiction_permissions','requested',current_date+80);
 SELECT alert_level INTO level FROM public.mwd_owner_partner_expiry_dashboard_demo(30)
 WHERE partner_id=p AND requirement_type='regulatory_license';
 IF level<>'expired' THEN RAISE EXCEPTION 'Expired license incorrectly classified: %',level;END IF;
 SELECT alert_level INTO level FROM public.mwd_owner_partner_expiry_dashboard_demo(30)
 WHERE partner_id=p AND requirement_type='signed_agreement';
 IF level<>'later' THEN RAISE EXCEPTION '30 day window incorrect: %',level;END IF;
 SELECT alert_level INTO level FROM public.mwd_owner_partner_expiry_dashboard_demo(60)
 WHERE partner_id=p AND requirement_type='signed_agreement';
 IF level<>'due_within_window' THEN RAISE EXCEPTION '60 day window incorrect: %',level;END IF;
 SELECT alert_level INTO level FROM public.mwd_owner_partner_expiry_dashboard_demo(90)
 WHERE partner_id=p AND requirement_type='jurisdiction_permissions';
 IF level<>'due_within_window' THEN RAISE EXCEPTION '90 day window incorrect: %',level;END IF;
 SELECT count(*) INTO n FROM public.mwd_owner_partner_audit_demo(p)
 WHERE entity_type='due_diligence_reviews';
 IF n<>3 THEN RAISE EXCEPTION 'Expiry changes not audited: %',n;END IF;
 IF ans->>'real_payouts_enabled'<>'false' THEN RAISE EXCEPTION 'Payments unexpectedly enabled';END IF;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;
SELECT 'Expiry metadata: owner-only, 30/60/90 day alerts, persistence and audit OK' result;
