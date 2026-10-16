-- Moneda Mundial 2.0 | INVESTIGACIÓN de persistencia y deduplicación.
-- Ejecutar exclusivamente en PostgreSQL desechable CI.
-- No desplegar en Supabase ni exponer a cliente, red, API o dinero real.
-- No se almacena PII, tokens, claves ni eventos bancarios verdaderos.
CREATE SCHEMA IF NOT EXISTS mwd_inbox_research;
REVOKE ALL ON SCHEMA mwd_inbox_research FROM PUBLIC,anon,authenticated;

CREATE TABLE mwd_inbox_research.orders(
  provider_id text NOT NULL CHECK(provider_id IN (
    'future_regulated_provider_alpha','future_regulated_provider_beta')),
  order_id text NOT NULL CHECK(order_id ~ '^[A-Za-z0-9_-]{12,90}$'),
  destination text NOT NULL CHECK(destination IN ('HN','NI')),
  currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
  amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 100 AND 10000000),
  stage text NOT NULL DEFAULT 'registered_mock'
    CHECK(stage IN ('registered_mock','funding_pending_mock','funding_settled_mock',
      'payout_pending_mock','payout_failed_mock','payout_settled_mock',
      'refund_pending_mock','refund_settled_mock')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(provider_id,order_id)
);

CREATE TABLE mwd_inbox_research.received_events(
  provider_id text NOT NULL,
  order_id text NOT NULL,
  event_id text NOT NULL CHECK(event_id ~ '^[A-Za-z0-9_-]{12,90}$'),
  phase text NOT NULL CHECK(phase IN ('funding_pending_mock','funding_settled_mock',
    'payout_pending_mock','payout_failed_mock','payout_settled_mock',
    'refund_pending_mock','refund_settled_mock')),
  payload_sha256 text NOT NULL CHECK(payload_sha256 ~ '^[0-9a-f]{64}$'),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(provider_id,event_id),
  UNIQUE(provider_id,order_id,phase),
  FOREIGN KEY(provider_id,order_id)
    REFERENCES mwd_inbox_research.orders(provider_id,order_id) ON DELETE RESTRICT
);
CREATE INDEX research_events_by_order
  ON mwd_inbox_research.received_events(provider_id,order_id,received_at);

CREATE OR REPLACE FUNCTION mwd_inbox_research.reject_history_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'Eventos de laboratorio sólo permiten añadir registros' USING ERRCODE='42501';
END $$;
CREATE TRIGGER research_events_append_only
 BEFORE UPDATE OR DELETE ON mwd_inbox_research.received_events
 FOR EACH ROW EXECUTE FUNCTION mwd_inbox_research.reject_history_mutation();

-- Estas funciones son SECURITY INVOKER y se revocan a clientes.
-- Los parámetros son pruebas ficticias, NO prueba de autenticación ni de fondeo.
-- No se admite un parámetro authenticated=true para atribuir legitimidad.
CREATE OR REPLACE FUNCTION mwd_inbox_research.register_mock_order(
 p_provider text,p_order text,p_destination text,p_amount bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v mwd_inbox_research.orders%rowtype;v_new text;
BEGIN
 IF p_provider NOT IN ('future_regulated_provider_alpha','future_regulated_provider_beta')
 OR p_provider IS NULL OR p_order IS NULL OR p_order !~ '^[A-Za-z0-9_-]{12,90}$'
 OR p_destination IS NULL OR p_destination NOT IN ('HN','NI')
 OR p_amount IS NULL OR p_amount NOT BETWEEN 100 AND 10000000
 THEN RAISE EXCEPTION 'Orden ficticia inválida' USING ERRCODE='22023';END IF;
 INSERT INTO mwd_inbox_research.orders(provider_id,order_id,destination,currency,amount_minor)
 VALUES(p_provider,p_order,p_destination,'USD',p_amount)
 ON CONFLICT(provider_id,order_id) DO NOTHING RETURNING order_id INTO v_new;
 SELECT * INTO STRICT v FROM mwd_inbox_research.orders
  WHERE provider_id=p_provider AND order_id=p_order FOR UPDATE;
 IF v.destination<>p_destination OR v.amount_minor<>p_amount
 THEN RAISE EXCEPTION 'Identificador de orden reutilizado' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object('order_id',v.order_id,'stage',v.stage,
 'already_processed',v_new IS NULL,'real_money_enabled',false,'bank_connected',false);
END $$;

CREATE OR REPLACE FUNCTION mwd_inbox_research.record_mock_event(
 p_provider text,p_order text,p_event text,p_phase text,p_sha text,
 p_destination text,p_amount bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 v mwd_inbox_research.orders%rowtype;
 existing mwd_inbox_research.received_events%rowtype;
 v_allowed boolean:=false;
BEGIN
 IF p_provider IS NULL OR p_order IS NULL OR p_event IS NULL OR
 p_order !~ '^[A-Za-z0-9_-]{12,90}$' OR
 p_event !~ '^[A-Za-z0-9_-]{12,90}$' OR
 p_phase IS NULL OR p_phase NOT IN ('funding_pending_mock','funding_settled_mock',
    'payout_pending_mock','payout_failed_mock','payout_settled_mock',
    'refund_pending_mock','refund_settled_mock') OR
 p_sha IS NULL OR p_sha !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'Evento DEMO inválido' USING ERRCODE='22023';END IF;
 -- Bloqueo por orden impide que dos transacciones acepten fases incompatibles.
 SELECT * INTO v FROM mwd_inbox_research.orders
 WHERE provider_id=p_provider AND order_id=p_order FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Orden de proveedor desconocida' USING ERRCODE='22023';END IF;
 IF p_destination IS DISTINCT FROM v.destination OR p_amount IS DISTINCT FROM v.amount_minor
 THEN RAISE EXCEPTION 'Monto o país del evento no coincide con orden' USING ERRCODE='22023';END IF;
 SELECT * INTO existing FROM mwd_inbox_research.received_events
 WHERE provider_id=p_provider AND event_id=p_event;
 IF FOUND THEN
   IF existing.order_id<>p_order OR existing.phase<>p_phase OR existing.payload_sha256<>p_sha
   THEN RAISE EXCEPTION 'Reutilización conflictiva de evento' USING ERRCODE='22023';END IF;
   RETURN jsonb_build_object('already_processed',true,'stage',v.stage,
     'event_accepted_mock',true,'real_money_enabled',false,'ledger_posted',false);
 END IF;
 v_allowed:=CASE v.stage
   WHEN 'registered_mock' THEN p_phase IN ('funding_pending_mock','funding_settled_mock')
   WHEN 'funding_pending_mock' THEN p_phase='funding_settled_mock'
   WHEN 'funding_settled_mock' THEN p_phase IN ('payout_pending_mock','refund_pending_mock')
   WHEN 'payout_pending_mock' THEN p_phase IN ('payout_failed_mock','payout_settled_mock')
   WHEN 'payout_failed_mock' THEN p_phase='refund_pending_mock'
   WHEN 'refund_pending_mock' THEN p_phase='refund_settled_mock'
   ELSE false END;
 IF NOT v_allowed THEN RAISE EXCEPTION 'Transición DEMO fuera de orden' USING ERRCODE='22023';END IF;
 INSERT INTO mwd_inbox_research.received_events(
   provider_id,order_id,event_id,phase,payload_sha256
 ) VALUES(p_provider,p_order,p_event,p_phase,p_sha);
 UPDATE mwd_inbox_research.orders SET stage=p_phase
 WHERE provider_id=p_provider AND order_id=p_order;
 RETURN jsonb_build_object('already_processed',false,'stage',p_phase,
   'event_accepted_mock',true,'real_money_enabled',false,
   'ledger_posted',false,'real_bank_verified',false);
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA mwd_inbox_research FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA mwd_inbox_research FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_inbox_research FROM PUBLIC,anon,authenticated;
COMMENT ON SCHEMA mwd_inbox_research IS
'EXCLUSIVAMENTE LABORATORIO CI. NO USAR CON EVENTOS/CLIENTES REALES. No es autorización para mover dinero.';
