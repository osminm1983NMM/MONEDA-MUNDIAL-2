-- MWD 2.0: bitácora persistente de revisiones ficticias.
-- SÓLO PostgreSQL desechable CI ledger_test. NO instalar en Supabase ni usar
-- con clientes, personas, bancos, credenciales o fondos reales.
-- No es un almacén WORM ni prueba forense; PostgreSQL owner/superuser
-- puede modificar la cadena. Nunca libera pagos ni aprueba criptomonedas.

CREATE TABLE mwd_access_research.mock_review_audit_head(
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton=true),
  last_seq bigint NOT NULL CHECK(last_seq>=0),
  last_hash text NOT NULL CHECK(last_hash ~ '^[0-9a-f]{64}$')
);
INSERT INTO mwd_access_research.mock_review_audit_head(singleton,last_seq,last_hash)
 VALUES(true,0,repeat('0',64));

CREATE TABLE mwd_access_research.mock_review_audit_entries(
 seq bigint PRIMARY KEY CHECK(seq>0),
 event_id uuid NOT NULL UNIQUE,
 review_id uuid NOT NULL,
 case_id text NOT NULL REFERENCES mwd_access_research.work_items(case_id) ON DELETE RESTRICT,
 institution_id text NOT NULL CHECK(institution_id IN ('bank-hn','bank-ni','agent-hn','agent-ni')),
 actor_alias text NOT NULL CHECK(actor_alias ~ '^mock-[A-Za-z0-9_-]{8,40}$'),
 kind text NOT NULL CHECK(kind IN ('review_created_mock','second_review_recorded_mock',
   'review_expired_mock','review_initiator_revoked_mock',
   'self_review_rejected_mock','cross_institution_rejected_mock')),
 action text NOT NULL CHECK(action IN ('bank_payout','refund_approval',
   'cash_pickup_release','staff_membership_change','crypto_exchange')),
 state text NOT NULL CHECK(state IN ('pending_mock','dual_review_recorded_mock',
   'expired_mock','void_member_revoked_mock')),
 recorded_at timestamptz NOT NULL,
 previous_hash text NOT NULL CHECK(previous_hash ~ '^[0-9a-f]{64}$'),
 entry_hash text NOT NULL CHECK(entry_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX mock_review_events_by_review
 ON mwd_access_research.mock_review_audit_entries(review_id,seq);
ALTER TABLE mwd_access_research.mock_review_audit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_access_research.mock_review_audit_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY mock_owner_review_audit_read
 ON mwd_access_research.mock_review_audit_entries
 FOR SELECT TO mwd_lab_owner USING(true);
REVOKE ALL ON mwd_access_research.mock_review_audit_entries FROM PUBLIC,anon,authenticated;
REVOKE ALL ON mwd_access_research.mock_review_audit_head FROM PUBLIC,anon,authenticated;
GRANT SELECT ON mwd_access_research.mock_review_audit_entries TO mwd_lab_owner;

CREATE OR REPLACE FUNCTION mwd_access_research.mock_review_hash(
 p_seq bigint,p_event uuid,p_review uuid,p_case text,p_institution text,
 p_actor text,p_kind text,p_action text,p_state text,p_time timestamptz,
 p_previous text
) RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
 SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
   pg_catalog.jsonb_build_array(p_seq,p_event::text,p_review::text,p_case,
     p_institution,p_actor,p_kind,p_action,p_state,
     EXTRACT(EPOCH FROM p_time),p_previous)::text,
   'UTF8')), 'hex')
$$;

-- Sólo propietario (CI) puede escribir a través de esta función invoker.
-- Exclusividad en la fila singleton serializa todas las cadenas.
-- Una segunda ejecución del mismo event_id con distinto contenido falla.
CREATE OR REPLACE FUNCTION mwd_access_research.append_mock_review_audit(
 p_event uuid,p_review uuid,p_case text,p_institution text,
 p_actor text,p_kind text,p_action text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 v_head mwd_access_research.mock_review_audit_head%rowtype;
 v_existing mwd_access_research.mock_review_audit_entries%rowtype;
 v_case mwd_access_research.work_items%rowtype;
 v_created mwd_access_research.mock_review_audit_entries%rowtype;
 v_seq bigint;
 v_state text;
 v_date timestamptz;
 v_hash text;
BEGIN
 IF p_event IS NULL OR p_review IS NULL OR p_case IS NULL OR
   p_case !~ '^SIM-(HN|NI)-[0-9]{3}$' OR p_institution IS NULL OR
   p_institution NOT IN ('bank-hn','bank-ni','agent-hn','agent-ni') OR
   p_actor IS NULL OR p_actor !~ '^mock-[A-Za-z0-9_-]{8,40}$' OR
   p_kind IS NULL OR p_kind NOT IN ('review_created_mock',
     'second_review_recorded_mock','review_expired_mock',
     'review_initiator_revoked_mock','self_review_rejected_mock',
     'cross_institution_rejected_mock') OR
   p_action IS NULL OR p_action NOT IN ('bank_payout','refund_approval',
     'cash_pickup_release','staff_membership_change','crypto_exchange')
 THEN
   RAISE EXCEPTION 'Evento ficticio de revisión inválido' USING ERRCODE='22023';
 END IF;
 -- Este lock también hace idempotencia atómica para dos procesos CI.
 SELECT * INTO STRICT v_head FROM mwd_access_research.mock_review_audit_head
  WHERE singleton=true FOR UPDATE;
 SELECT * INTO v_existing FROM mwd_access_research.mock_review_audit_entries
 WHERE event_id=p_event;
 IF FOUND THEN
   IF v_existing.review_id<>p_review OR v_existing.case_id<>p_case OR
      v_existing.institution_id<>p_institution OR v_existing.actor_alias<>p_actor OR
      v_existing.kind<>p_kind OR v_existing.action<>p_action
   THEN RAISE EXCEPTION 'Event ID reutilizado con datos distintos' USING ERRCODE='22023';
   END IF;
   RETURN jsonb_build_object('seq',v_existing.seq,'already_processed',true,
     'real_money_enabled',false,'audit_is_legal_evidence',false);
 END IF;
 SELECT * INTO v_case FROM mwd_access_research.work_items WHERE case_id=p_case;
 IF NOT FOUND OR v_case.country_code<>upper(split_part(p_institution,'-',2))
   OR (p_institution LIKE 'bank-%' AND v_case.bank_role::text<>
       'mwd_lab_bank_'||lower(v_case.country_code))
   OR (p_institution LIKE 'agent-%' AND v_case.agent_role::text<>
       'mwd_lab_agent_'||lower(v_case.country_code))
 THEN RAISE EXCEPTION 'Caso ficticio fuera de institución' USING ERRCODE='22023';
 END IF;

 -- Validación de progresión contra el historial ya registrado.
 SELECT * INTO v_created FROM mwd_access_research.mock_review_audit_entries
  WHERE review_id=p_review AND kind='review_created_mock'
  ORDER BY seq LIMIT 1;
 IF p_kind='review_created_mock' THEN
   IF FOUND THEN RAISE EXCEPTION 'Revisión ya fue creada' USING ERRCODE='22023'; END IF;
   v_state:='pending_mock';
 ELSE
   IF NOT FOUND THEN RAISE EXCEPTION 'Revisión inexistente' USING ERRCODE='22023';END IF;
   IF v_created.case_id<>p_case OR v_created.institution_id<>p_institution
      OR v_created.action<>p_action THEN
     RAISE EXCEPTION 'Revisión ficticia no corresponde al caso' USING ERRCODE='22023';
   END IF;
   IF EXISTS(SELECT 1 FROM mwd_access_research.mock_review_audit_entries
    WHERE review_id=p_review AND kind IN ('second_review_recorded_mock',
      'review_expired_mock','review_initiator_revoked_mock'))
   THEN RAISE EXCEPTION 'Revisión finalizada' USING ERRCODE='22023';END IF;
   IF p_kind='second_review_recorded_mock' THEN
     IF p_actor=v_created.actor_alias THEN
       RAISE EXCEPTION 'Una persona no puede completar ambas revisiones'
       USING ERRCODE='22023';
     END IF;
     v_state:='dual_review_recorded_mock';
   ELSIF p_kind='review_expired_mock' THEN
     v_state:='expired_mock';
   ELSIF p_kind='review_initiator_revoked_mock' THEN
     v_state:='void_member_revoked_mock';
   ELSE
     -- Rechazos no autorizan pago ni completan la revisión.
     v_state:='pending_mock';
   END IF;
 END IF;

 v_seq:=v_head.last_seq+1;
 v_date:=clock_timestamp();
 v_hash:=mwd_access_research.mock_review_hash(v_seq,p_event,p_review,p_case,
  p_institution,p_actor,p_kind,p_action,v_state,v_date,v_head.last_hash);
 INSERT INTO mwd_access_research.mock_review_audit_entries(seq,event_id,review_id,
  case_id,institution_id,actor_alias,kind,action,state,recorded_at,
  previous_hash,entry_hash)
 VALUES(v_seq,p_event,p_review,p_case,p_institution,p_actor,p_kind,p_action,
  v_state,v_date,v_head.last_hash,v_hash);
 UPDATE mwd_access_research.mock_review_audit_head
  SET last_seq=v_seq,last_hash=v_hash WHERE singleton=true;
 RETURN jsonb_build_object('seq',v_seq,'already_processed',false,
  'real_money_enabled',false,'audit_is_legal_evidence',false);
END $$;

CREATE OR REPLACE FUNCTION mwd_access_research.verify_mock_review_audit()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  v_row mwd_access_research.mock_review_audit_entries%rowtype;
  v_prev text:=repeat('0',64);
  v_seq bigint:=0;
  v_head mwd_access_research.mock_review_audit_head%rowtype;
  v_ok boolean:=true;
BEGIN
  SELECT * INTO STRICT v_head FROM mwd_access_research.mock_review_audit_head
   WHERE singleton=true;
  FOR v_row IN SELECT * FROM mwd_access_research.mock_review_audit_entries
    ORDER BY seq LOOP
    v_seq:=v_seq+1;
    IF v_row.seq<>v_seq OR v_row.previous_hash<>v_prev OR
       v_row.entry_hash<>mwd_access_research.mock_review_hash(
        v_row.seq,v_row.event_id,v_row.review_id,v_row.case_id,
        v_row.institution_id,v_row.actor_alias,v_row.kind,v_row.action,
        v_row.state,v_row.recorded_at,v_row.previous_hash)
    THEN v_ok:=false; EXIT;END IF;
    v_prev:=v_row.entry_hash;
  END LOOP;
  v_ok:=v_ok AND v_seq=v_head.last_seq AND v_prev=v_head.last_hash;
  RETURN jsonb_build_object('integrity_ok_mock',v_ok,'events_checked',v_seq,
   'legal_evidence',false,'external_anchor_verified',false,
   'real_money_enabled',false);
END $$;

-- La escritura sólo tiene lugar dentro de la función, sin grants externos.
CREATE OR REPLACE FUNCTION mwd_access_research.reject_mock_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'Bitácora ficticia sólo anexado (en el flujo normal)'
 USING ERRCODE='42501';
END $$;
CREATE TRIGGER research_audit_entries_append_only
 BEFORE UPDATE OR DELETE ON mwd_access_research.mock_review_audit_entries
 FOR EACH ROW EXECUTE FUNCTION mwd_access_research.reject_mock_audit_mutation();

REVOKE ALL ON FUNCTION mwd_access_research.mock_review_hash(
 bigint,uuid,uuid,text,text,text,text,text,text,timestamptz,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION mwd_access_research.append_mock_review_audit(
 uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION mwd_access_research.verify_mock_review_audit()
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION mwd_access_research.reject_mock_audit_mutation()
 FROM PUBLIC,anon,authenticated;

COMMENT ON TABLE mwd_access_research.mock_review_audit_entries IS
'LABORATORIO: datos inventados, bitácora con cadena hash sin sello externo. NO producción.';
