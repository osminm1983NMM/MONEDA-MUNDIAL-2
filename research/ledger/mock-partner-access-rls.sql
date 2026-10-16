-- MONEDA MUNDIAL — acceso de instituciones, EXCLUSIVAMENTE LABORATORIO CI.
-- NO ejecutar en Supabase ni bases reales; sin usuarios ni datos bancarios.
-- En producción, JWT verificado y permisos por entidad deben existir en backend.
CREATE ROLE mwd_lab_owner NOLOGIN;
CREATE ROLE mwd_lab_bank_hn NOLOGIN;
CREATE ROLE mwd_lab_bank_ni NOLOGIN;
CREATE ROLE mwd_lab_agent_hn NOLOGIN;
CREATE ROLE mwd_lab_agent_ni NOLOGIN;

CREATE SCHEMA mwd_access_research;
REVOKE ALL ON SCHEMA mwd_access_research FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA mwd_access_research TO
 mwd_lab_owner,mwd_lab_bank_hn,mwd_lab_bank_ni,mwd_lab_agent_hn,mwd_lab_agent_ni;

CREATE TABLE mwd_access_research.work_items(
 case_id text PRIMARY KEY CHECK(case_id ~ '^SIM-(HN|NI)-[0-9]{3}$'),
 country_code text NOT NULL CHECK(country_code IN ('HN','NI')),
 bank_role name NOT NULL,
 agent_role name NOT NULL,
 status text NOT NULL CHECK(status IN ('review_mock','payout_pending_mock','refund_pending_mock')),
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 100 AND 10000000),
 risk_code text NOT NULL CHECK(risk_code IN ('duplicate_mock','mismatch_mock','delay_mock')),
 CHECK (
 (country_code='HN' AND bank_role='mwd_lab_bank_hn' AND agent_role='mwd_lab_agent_hn')
 OR
 (country_code='NI' AND bank_role='mwd_lab_bank_ni' AND agent_role='mwd_lab_agent_ni')
 )
);
ALTER TABLE mwd_access_research.work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_access_research.work_items FORCE ROW LEVEL SECURITY;
CREATE POLICY research_owner_items ON mwd_access_research.work_items
 FOR SELECT TO mwd_lab_owner USING (true);
CREATE POLICY research_bank_items ON mwd_access_research.work_items
 FOR SELECT TO mwd_lab_bank_hn,mwd_lab_bank_ni
 USING (bank_role=current_user);
CREATE POLICY research_agent_items ON mwd_access_research.work_items
 FOR SELECT TO mwd_lab_agent_hn,mwd_lab_agent_ni
 USING (agent_role=current_user);

REVOKE ALL ON mwd_access_research.work_items FROM PUBLIC,anon,authenticated;
GRANT SELECT ON mwd_access_research.work_items TO mwd_lab_owner;
GRANT SELECT(case_id,country_code,status,amount_minor,risk_code)
 ON mwd_access_research.work_items TO mwd_lab_bank_hn,mwd_lab_bank_ni;
GRANT SELECT(case_id,country_code,status)
 ON mwd_access_research.work_items TO mwd_lab_agent_hn,mwd_lab_agent_ni;

-- Sólo registro de que un revisor pide investigar; nunca autoriza pagar.
-- El usuario no recibe permiso para escribir actor_role (derivado por Postgres).
CREATE TABLE mwd_access_research.review_actions(
 action_id uuid PRIMARY KEY,
 case_id text NOT NULL REFERENCES mwd_access_research.work_items(case_id) ON DELETE RESTRICT,
 actor_role name NOT NULL DEFAULT current_user,
 action_code text NOT NULL CHECK(action_code='request_manual_review_mock'),
 note_code text NOT NULL CHECK(note_code IN ('duplicate_mock','discrepancy_mock','unknown_mock')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE mwd_access_research.review_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_access_research.review_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY research_write_review ON mwd_access_research.review_actions
 FOR INSERT TO mwd_lab_owner,mwd_lab_bank_hn,mwd_lab_bank_ni,mwd_lab_agent_hn,mwd_lab_agent_ni
 WITH CHECK (
 actor_role=current_user AND
 EXISTS (
  SELECT 1 FROM mwd_access_research.work_items i
  WHERE i.case_id=review_actions.case_id
 )
);
CREATE POLICY research_owner_audit ON mwd_access_research.review_actions
 FOR SELECT TO mwd_lab_owner USING (true);

CREATE OR REPLACE FUNCTION mwd_access_research.reject_review_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'AUDITORIA DEMO: registros append-only' USING ERRCODE='42501';
END $$;
CREATE TRIGGER review_append_only
 BEFORE UPDATE OR DELETE ON mwd_access_research.review_actions
 FOR EACH ROW EXECUTE FUNCTION mwd_access_research.reject_review_mutation();

REVOKE ALL ON mwd_access_research.review_actions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON mwd_access_research.review_actions TO mwd_lab_owner;
GRANT INSERT(action_id,case_id,action_code,note_code)
 ON mwd_access_research.review_actions TO
 mwd_lab_owner,mwd_lab_bank_hn,mwd_lab_bank_ni,mwd_lab_agent_hn,mwd_lab_agent_ni;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_access_research FROM PUBLIC,anon,authenticated;

-- Solo inserts del dueño privilegiado del CI; entidades de muestra inventadas.
INSERT INTO mwd_access_research.work_items(
 case_id,country_code,bank_role,agent_role,status,amount_minor,risk_code)
VALUES
 ('SIM-HN-001','HN','mwd_lab_bank_hn','mwd_lab_agent_hn','review_mock',10000,'duplicate_mock'),
 ('SIM-HN-002','HN','mwd_lab_bank_hn','mwd_lab_agent_hn','payout_pending_mock',85000,'delay_mock'),
 ('SIM-NI-001','NI','mwd_lab_bank_ni','mwd_lab_agent_ni','refund_pending_mock',10000,'mismatch_mock'),
 ('SIM-NI-002','NI','mwd_lab_bank_ni','mwd_lab_agent_ni','review_mock',2500,'delay_mock');
COMMENT ON SCHEMA mwd_access_research IS
'CI ONLY — NO PII, NO BANK CONNECTED, NO PERMISSION TO PAY; NOT DEPLOYED TO SUPABASE.';
