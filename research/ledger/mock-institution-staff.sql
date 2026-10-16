-- MONEDA MUNDIAL: membresías de empleados de instituciones — CI DE LABORATORIO.
-- Exclusivamente PostgreSQL `ledger_test` efímero. NO tocar Supabase.
-- No autentica personas, no crea credenciales reales, no acepta dinero ni PII.
-- Los roles Postgres NOLOGIN permiten simular una identidad ya comprobada.
CREATE ROLE mwd_lab_staff_bank_hn NOLOGIN;
CREATE ROLE mwd_lab_staff_bank_ni_pending NOLOGIN;
CREATE ROLE mwd_lab_staff_agent_ni NOLOGIN;

GRANT USAGE ON SCHEMA mwd_access_research TO
 mwd_lab_staff_bank_hn,mwd_lab_staff_bank_ni_pending,mwd_lab_staff_agent_ni;

CREATE TABLE mwd_access_research.staff_memberships(
 staff_role name PRIMARY KEY,
 institution_role name NOT NULL CHECK (institution_role IN (
  'mwd_lab_bank_hn','mwd_lab_bank_ni','mwd_lab_agent_hn','mwd_lab_agent_ni')),
 institution_kind text NOT NULL CHECK(institution_kind IN ('bank','agent')),
 membership_state text NOT NULL CHECK(membership_state IN ('pending_mock','active_mock','revoked_mock')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK ((institution_kind='bank' AND institution_role IN ('mwd_lab_bank_hn','mwd_lab_bank_ni'))
     OR (institution_kind='agent' AND institution_role IN ('mwd_lab_agent_hn','mwd_lab_agent_ni'))),
 CHECK(staff_role IN (
  'mwd_lab_staff_bank_hn','mwd_lab_staff_bank_ni_pending','mwd_lab_staff_agent_ni'))
);
ALTER TABLE mwd_access_research.staff_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_access_research.staff_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY research_owner_staff_read ON mwd_access_research.staff_memberships
 FOR SELECT TO mwd_lab_owner USING (true);
CREATE POLICY research_self_staff_read ON mwd_access_research.staff_memberships
 FOR SELECT TO mwd_lab_staff_bank_hn,mwd_lab_staff_bank_ni_pending,mwd_lab_staff_agent_ni
 USING (staff_role=current_user);

-- Roles de muestra sólo pueden LEER sus propias membresías: ninguna inserción,
-- activación, modificación de alcance o revocación está disponible al empleado.
REVOKE ALL ON mwd_access_research.staff_memberships FROM PUBLIC,anon,authenticated;
GRANT SELECT ON mwd_access_research.staff_memberships TO
 mwd_lab_owner,mwd_lab_staff_bank_hn,mwd_lab_staff_bank_ni_pending,mwd_lab_staff_agent_ni;

CREATE TABLE mwd_access_research.staff_membership_audit(
 audit_no bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 staff_role name NOT NULL,
 institution_role name NOT NULL,
 transition text NOT NULL CHECK(transition IN ('seeded_pending_mock','seeded_active_mock',
  'activated_mock','revoked_mock')),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE mwd_access_research.staff_membership_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_access_research.staff_membership_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY research_owner_staff_audit ON mwd_access_research.staff_membership_audit
 FOR SELECT TO mwd_lab_owner USING (true);
REVOKE ALL ON mwd_access_research.staff_membership_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON mwd_access_research.staff_membership_audit TO mwd_lab_owner;

CREATE OR REPLACE FUNCTION mwd_access_research.guard_mock_membership()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.staff_role IS DISTINCT FROM OLD.staff_role
    OR NEW.institution_role IS DISTINCT FROM OLD.institution_role
    OR NEW.institution_kind IS DISTINCT FROM OLD.institution_kind
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'No se permite reasignar identidades de prueba'
   USING ERRCODE='42501';
 END IF;
 IF NOT ((OLD.membership_state='pending_mock' AND NEW.membership_state='active_mock')
      OR (OLD.membership_state='active_mock' AND NEW.membership_state='revoked_mock')) THEN
  RAISE EXCEPTION 'Cambio de membresía de prueba no permitido'
   USING ERRCODE='42501';
 END IF;
 NEW.changed_at=clock_timestamp();
 RETURN NEW;
END $$;
CREATE TRIGGER guard_mock_membership_change
 BEFORE UPDATE ON mwd_access_research.staff_memberships
 FOR EACH ROW EXECUTE FUNCTION mwd_access_research.guard_mock_membership();

CREATE OR REPLACE FUNCTION mwd_access_research.audit_mock_membership()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 INSERT INTO mwd_access_research.staff_membership_audit(
  staff_role,institution_role,transition)
 VALUES(
  NEW.staff_role,NEW.institution_role,
  CASE WHEN TG_OP='INSERT' AND NEW.membership_state='pending_mock'
       THEN 'seeded_pending_mock'
       WHEN TG_OP='INSERT' THEN 'seeded_active_mock'
       WHEN NEW.membership_state='active_mock' THEN 'activated_mock'
       ELSE 'revoked_mock' END
 );
 RETURN NEW;
END $$;
CREATE TRIGGER log_mock_membership_changes
 AFTER INSERT OR UPDATE ON mwd_access_research.staff_memberships
 FOR EACH ROW EXECUTE FUNCTION mwd_access_research.audit_mock_membership();

CREATE OR REPLACE FUNCTION mwd_access_research.block_membership_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'Historial de membresías DEMO no editable' USING ERRCODE='42501';
END $$;
CREATE TRIGGER block_membership_audit_change
 BEFORE UPDATE OR DELETE ON mwd_access_research.staff_membership_audit
 FOR EACH ROW EXECUTE FUNCTION mwd_access_research.block_membership_audit_mutation();

-- Casos reales NUNCA se habilitan por esta base de datos. El registro es solo
-- un fixture con estados predefinidos, sin invitaciones ni KYC de terceros.
INSERT INTO mwd_access_research.staff_memberships(
 staff_role,institution_role,institution_kind,membership_state)
VALUES
 ('mwd_lab_staff_bank_hn','mwd_lab_bank_hn','bank','active_mock'),
 ('mwd_lab_staff_bank_ni_pending','mwd_lab_bank_ni','bank','pending_mock'),
 ('mwd_lab_staff_agent_ni','mwd_lab_agent_ni','agent','active_mock');

-- Permisos de consulta por persona ya autenticada (simulación SET ROLE).
-- RLS además exige membresía ACTIVA en una sola institución.
CREATE POLICY research_employee_items ON mwd_access_research.work_items
 FOR SELECT TO mwd_lab_staff_bank_hn,mwd_lab_staff_bank_ni_pending,mwd_lab_staff_agent_ni
 USING (
   EXISTS(
    SELECT 1 FROM mwd_access_research.staff_memberships AS staff
     WHERE staff.staff_role=current_user
       AND staff.membership_state='active_mock'
       AND (
        (staff.institution_kind='bank' AND staff.institution_role=work_items.bank_role)
        OR
        (staff.institution_kind='agent' AND staff.institution_role=work_items.agent_role)
       )
   )
 );
GRANT SELECT(case_id,country_code,status,amount_minor,risk_code)
 ON mwd_access_research.work_items TO mwd_lab_staff_bank_hn,mwd_lab_staff_bank_ni_pending;
GRANT SELECT(case_id,country_code,status)
 ON mwd_access_research.work_items TO mwd_lab_staff_agent_ni;

-- Acción sólo para solicitar revisión, no para resolver el caso.
CREATE POLICY research_employee_request_review ON mwd_access_research.review_actions
 FOR INSERT TO mwd_lab_staff_bank_hn,mwd_lab_staff_bank_ni_pending,mwd_lab_staff_agent_ni
 WITH CHECK(
  actor_role=current_user
  AND EXISTS(
   SELECT 1 FROM mwd_access_research.work_items AS item
    WHERE item.case_id=review_actions.case_id
  )
 );
GRANT INSERT(action_id,case_id,action_code,note_code)
 ON mwd_access_research.review_actions
 TO mwd_lab_staff_bank_hn,mwd_lab_staff_bank_ni_pending,mwd_lab_staff_agent_ni;

-- Ningún usuario móvil anónimo o autenticado recibe acceso directo.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_access_research FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE mwd_access_research.staff_memberships IS
'SOLO CI: la verificación de identidad y facultad de empleados NO ESTÁ IMPLEMENTADA. No usar en Supabase.';
