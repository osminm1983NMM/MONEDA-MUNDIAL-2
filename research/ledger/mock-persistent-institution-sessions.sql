-- MONEDA MUNDIAL: sesiones institucionales PERSISTENTES de LABORATORIO.
-- Ejecutar exclusivamente en el servicio PostgreSQL desechable "ledger_test" CI.
-- Esta tabla NO verifica identidades, MFA ni firmas: filas sólo fixtures de test.
-- No instalar en Supabase. No almacena tokens reales, PII, claves o dinero.
CREATE TABLE mwd_access_research.mock_sessions(
 token_sha256 text PRIMARY KEY CHECK(token_sha256 ~ '^[0-9a-f]{64}$'),
 staff_role name NOT NULL REFERENCES mwd_access_research.staff_memberships(staff_role) ON DELETE RESTRICT,
 institution_role name NOT NULL,
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 assurance text NOT NULL DEFAULT 'lab_only' CHECK(assurance='lab_only'),
 CHECK(expires_at>issued_at),
 CHECK(revoked_at IS NULL OR revoked_at>=issued_at)
);
CREATE INDEX mock_sessions_by_staff ON mwd_access_research.mock_sessions(staff_role);
ALTER TABLE mwd_access_research.mock_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_access_research.mock_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY mock_owner_can_read_session_metadata
 ON mwd_access_research.mock_sessions FOR SELECT TO mwd_lab_owner USING(true);
REVOKE ALL ON mwd_access_research.mock_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON mwd_access_research.mock_sessions TO mwd_lab_owner;

CREATE OR REPLACE FUNCTION mwd_access_research.prevent_mock_session_rewrite()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.token_sha256 IS DISTINCT FROM OLD.token_sha256
    OR NEW.staff_role IS DISTINCT FROM OLD.staff_role
    OR NEW.institution_role IS DISTINCT FROM OLD.institution_role
    OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR NEW.assurance IS DISTINCT FROM OLD.assurance
    OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)
    OR (OLD.revoked_at IS NULL AND NEW.revoked_at IS NULL)
 THEN
  RAISE EXCEPTION 'Sesión DEMO sólo permite pasar de activa a revocada' USING ERRCODE='42501';
 END IF;
 IF NEW.revoked_at IS NULL THEN
  RAISE EXCEPTION 'Revocación DEMO no puede ser nula' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER only_mock_session_revoke
 BEFORE UPDATE ON mwd_access_research.mock_sessions
 FOR EACH ROW EXECUTE FUNCTION mwd_access_research.prevent_mock_session_rewrite();

CREATE OR REPLACE FUNCTION mwd_access_research.mock_session_authorize(
 p_token_digest text, p_case_id text, p_action text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 v_session mwd_access_research.mock_sessions%rowtype;
 v_member mwd_access_research.staff_memberships%rowtype;
 v_item mwd_access_research.work_items%rowtype;
 v_allowed boolean;
BEGIN
 -- Sólo accesible al ADMINISTRADOR del laboratorio: está prohibido dar
 -- ejecución al cliente o pasar un JWT de usuario sin validación externa.
 IF p_token_digest IS NULL OR p_token_digest !~ '^[0-9a-f]{64}$'
    OR p_case_id IS NULL OR p_case_id !~ '^SIM-(HN|NI)-[0-9]{3}$'
    OR p_action IS NULL OR p_action NOT IN ('read_mock_cases','request_mock_review')
 THEN
  RETURN jsonb_build_object('allowed',false,'reason','invalid_lab_request',
   'real_mfa_verified',false,'real_money_enabled',false);
 END IF;
 SELECT * INTO v_session FROM mwd_access_research.mock_sessions
 WHERE token_sha256=p_token_digest;
 IF NOT FOUND OR v_session.revoked_at IS NOT NULL OR
    v_session.expires_at<=clock_timestamp() OR
    v_session.assurance<>'lab_only' THEN
  RETURN jsonb_build_object('allowed',false,'reason','no_valid_lab_session',
   'real_mfa_verified',false,'real_money_enabled',false);
 END IF;
 SELECT * INTO v_member FROM mwd_access_research.staff_memberships
 WHERE staff_role=v_session.staff_role AND membership_state='active_mock'
   AND institution_role=v_session.institution_role;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('allowed',false,'reason','lab_membership_inactive',
   'real_mfa_verified',false,'real_money_enabled',false);
 END IF;
 SELECT * INTO v_item FROM mwd_access_research.work_items
 WHERE case_id=p_case_id;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('allowed',false,'reason','lab_case_missing',
   'real_mfa_verified',false,'real_money_enabled',false);
 END IF;
 v_allowed:=CASE v_member.institution_kind
   WHEN 'bank' THEN v_member.institution_role=v_item.bank_role
   WHEN 'agent' THEN v_member.institution_role=v_item.agent_role
   ELSE false END;
 RETURN jsonb_build_object(
  'allowed',v_allowed,
  'reason',CASE WHEN v_allowed THEN 'lab_scoped_access' ELSE 'cross_institution_denied' END,
  'real_mfa_verified',false,'real_money_enabled',false,
  'can_pay',false,'can_refund',false,'bank_connected',false);
END $$;

REVOKE ALL ON FUNCTION mwd_access_research.mock_session_authorize(text,text,text)
 FROM PUBLIC,anon,authenticated,
 mwd_lab_owner,mwd_lab_bank_hn,mwd_lab_bank_ni,
 mwd_lab_agent_hn,mwd_lab_agent_ni,
 mwd_lab_staff_bank_hn,mwd_lab_staff_bank_ni_pending,mwd_lab_staff_agent_ni;
-- No se concede EXECUTE a ningún empleado/institución ni a roles de app.
COMMENT ON TABLE mwd_access_research.mock_sessions IS
'LABORATORIO CI - Sólo digest hexadecimal de token totalmente inventado. No usar en producción.';
