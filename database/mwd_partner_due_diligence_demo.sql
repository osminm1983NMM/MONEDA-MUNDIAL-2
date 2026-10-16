-- Mirror of the deployed 2026-10-16 owner-only due diligence metadata logic.
-- PostgreSQL disposable CI database only. Requires partner-registry fixture + schema.
CREATE TABLE mwd_partners_private.due_diligence_reviews(
 id uuid primary key default gen_random_uuid(),
 partner_id uuid not null references mwd_partners_private.partners(id) on delete restrict,
 requirement_type text not null check(requirement_type in
 ('legal_registration','regulatory_license','jurisdiction_permissions',
 'signed_agreement','aml_kyc_program','sanctions_controls','consumer_protection',
 'data_security','settlement_controls','tax_reporting')),
 review_status text not null default 'not_started' check(review_status in
 ('not_started','requested','received_unverified','needs_changes','reviewed_internal')),
 valid_until date,
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint mwd_partner_due_diligence_unique unique(partner_id,requirement_type),
 constraint mwd_due_diligence_valid_date check(valid_until is null or valid_until>=date '1900-01-01'),
 constraint mwd_due_diligence_no_date_when_not_started check(review_status<>'not_started' or valid_until is null)
);
ALTER TABLE mwd_partners_private.due_diligence_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mwd_partners_private.due_diligence_reviews FROM PUBLIC,anon,authenticated;
CREATE TRIGGER mwd_due_diligence_audit_change AFTER INSERT OR UPDATE
 ON mwd_partners_private.due_diligence_reviews FOR EACH ROW
 EXECUTE FUNCTION mwd_partners_private.audit_change();

CREATE OR REPLACE FUNCTION public.mwd_owner_partner_due_diligence_demo(p_partner_id uuid)
RETURNS TABLE(requirement_type text,review_status text,valid_until date,updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM mwd_partners_private.assert_owner();
 IF p_partner_id IS NULL OR NOT EXISTS
 (SELECT 1 FROM mwd_partners_private.partners p WHERE p.id=p_partner_id)
 THEN RAISE EXCEPTION 'Candidato inexistente' USING ERRCODE='22023';END IF;
 RETURN QUERY SELECT c.req,coalesce(r.review_status,'not_started'::text),
 r.valid_until,r.updated_at FROM (VALUES
 ('legal_registration'::text),('regulatory_license'),('jurisdiction_permissions'),
 ('signed_agreement'),('aml_kyc_program'),('sanctions_controls'),('consumer_protection'),
 ('data_security'),('settlement_controls'),('tax_reporting')) c(req)
 LEFT JOIN mwd_partners_private.due_diligence_reviews r
 ON r.partner_id=p_partner_id AND r.requirement_type=c.req ORDER BY c.req;
END; $$;

CREATE OR REPLACE FUNCTION public.mwd_owner_partner_due_diligence_save_demo(
 p_partner_id uuid,p_requirement_type text,p_review_status text,p_valid_until date default null)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;
BEGIN
 v_actor:=mwd_partners_private.assert_owner();
 IF p_partner_id IS NULL OR p_requirement_type IS NULL OR p_requirement_type NOT IN (
 'legal_registration','regulatory_license','jurisdiction_permissions',
 'signed_agreement','aml_kyc_program','sanctions_controls','consumer_protection',
 'data_security','settlement_controls','tax_reporting')
 OR p_review_status IS NULL OR p_review_status NOT IN
 ('not_started','requested','received_unverified','needs_changes','reviewed_internal')
 OR (p_review_status='not_started' AND p_valid_until IS NOT NULL)
 OR (p_valid_until IS NOT NULL AND p_valid_until<date '1900-01-01')
 THEN RAISE EXCEPTION 'Datos de revisión inválidos' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM mwd_partners_private.partners p
 WHERE p.id=p_partner_id AND p.review_status<>'archived' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Socio inexistente o archivado' USING ERRCODE='22023';END IF;
 INSERT INTO mwd_partners_private.due_diligence_reviews
 (partner_id,requirement_type,review_status,valid_until,created_by,updated_by)
 VALUES(p_partner_id,p_requirement_type,p_review_status,p_valid_until,v_actor,v_actor)
 ON CONFLICT ON CONSTRAINT mwd_partner_due_diligence_unique DO UPDATE SET
 review_status=excluded.review_status,valid_until=excluded.valid_until,
 updated_by=v_actor,updated_at=now();
 RETURN jsonb_build_object('saved',true,'requirement_type',p_requirement_type,
 'review_status',p_review_status,'real_payouts_enabled',false,'real_partners_approved',false);
END; $$;
REVOKE ALL ON FUNCTION public.mwd_owner_partner_due_diligence_demo(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mwd_owner_partner_due_diligence_save_demo(uuid,text,text,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mwd_owner_partner_due_diligence_demo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mwd_owner_partner_due_diligence_save_demo(uuid,text,text,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.mwd_owner_partner_audit_demo(p_partner_id uuid)
RETURNS TABLE(entity_type text,action text,actor_id uuid,changed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM mwd_partners_private.assert_owner();
 RETURN QUERY SELECT a.entity_type,a.action,a.actor_id,a.changed_at
 FROM mwd_partners_private.change_audit a WHERE a.entity_id=p_partner_id
 OR (a.entity_type IN ('locations','due_diligence_reviews')
 AND coalesce(a.after_row->>'partner_id',a.before_row->>'partner_id')=p_partner_id::text)
 ORDER BY a.changed_at DESC,a.id DESC LIMIT 100;
END; $$;
