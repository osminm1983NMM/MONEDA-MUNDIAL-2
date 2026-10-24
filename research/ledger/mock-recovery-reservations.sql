-- MONEDA MUNDIAL 2.0: reservas de remesas DEMO para PostgreSQL DESECHABLE.
-- Nunca ejecutar sobre Supabase conectado, banco, saldo real o billetera cliente.
-- Sólo alias sintéticos, centavos ficticios y UUID de prueba.
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'ledger_test' THEN
  RAISE EXCEPTION 'Bloqueado: reservas DEMO solo en base desechable ledger_test'
   USING ERRCODE='42501';
 END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS mwd_recovery_research;
REVOKE ALL ON SCHEMA mwd_recovery_research FROM PUBLIC,anon,authenticated;

CREATE TABLE mwd_recovery_research.requests(
 actor_alias text NOT NULL CHECK(actor_alias ~ '^SIM-[A-Z]{2}-[A-Z0-9]{3,12}$'),
 request_id text NOT NULL CHECK(request_id ~ '^[A-Za-z0-9_-]{12,90}$'),
 preflight_id uuid NOT NULL,
 recipient_alias text NOT NULL CHECK(recipient_alias ~ '^SIM-[A-Z]{2}-[A-Z0-9]{3,12}$'),
 destination text NOT NULL CHECK(destination ~ '^[A-Z]{2}$'),
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 100 AND 10000000),
 status text NOT NULL DEFAULT 'pending_verification_mock'
   CHECK(status IN ('pending_verification_mock','verified_mock')),
 receipt_order_id uuid,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(actor_alias,request_id),
 UNIQUE(actor_alias,preflight_id),
 CHECK(destination=substring(recipient_alias from 5 for 2)),
 CHECK((status='pending_verification_mock' AND receipt_order_id IS NULL) OR
       (status='verified_mock' AND receipt_order_id IS NOT NULL))
);
ALTER TABLE mwd_recovery_research.requests ENABLE ROW LEVEL SECURITY;
-- Una cuenta sintética no puede comenzar DOS remesas pendientes a la vez.
-- La condición se impone en índice ÚNICO, también bajo concurrencia.
CREATE UNIQUE INDEX one_pending_request_per_mock_actor
 ON mwd_recovery_research.requests(actor_alias)
 WHERE status='pending_verification_mock';

CREATE OR REPLACE FUNCTION mwd_recovery_research.protect_request_history()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'No borrar reservas de investigación' USING ERRCODE='42501';
 END IF;
 IF NEW.actor_alias IS DISTINCT FROM OLD.actor_alias OR
    NEW.request_id IS DISTINCT FROM OLD.request_id OR
    NEW.preflight_id IS DISTINCT FROM OLD.preflight_id OR
    NEW.recipient_alias IS DISTINCT FROM OLD.recipient_alias OR
    NEW.destination IS DISTINCT FROM OLD.destination OR
    NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR
    OLD.status<>'pending_verification_mock' OR
    NEW.status<>'verified_mock' OR
    OLD.receipt_order_id IS NOT NULL OR NEW.receipt_order_id IS NULL
 THEN
  RAISE EXCEPTION 'Reserva DEMO solo admite confirmación final' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER no_request_mutation
 BEFORE UPDATE OR DELETE ON mwd_recovery_research.requests
 FOR EACH ROW EXECUTE FUNCTION mwd_recovery_research.protect_request_history();

CREATE OR REPLACE FUNCTION mwd_recovery_research.reserve_mock_request(
 p_actor text,p_request text,p_preflight uuid,p_recipient text,
 p_destination text,p_amount bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v mwd_recovery_research.requests%rowtype; inserted boolean;
BEGIN
 IF p_actor IS NULL OR p_actor !~ '^SIM-[A-Z]{2}-[A-Z0-9]{3,12}$' OR
    p_request IS NULL OR p_request !~ '^[A-Za-z0-9_-]{12,90}$' OR
    p_preflight IS NULL OR p_recipient IS NULL OR
    p_recipient !~ '^SIM-[A-Z]{2}-[A-Z0-9]{3,12}$' OR
    p_destination IS NULL OR p_destination !~ '^[A-Z]{2}$' OR
    p_destination<>substring(p_recipient from 5 for 2) OR
    p_amount IS NULL OR p_amount NOT BETWEEN 100 AND 10000000
 THEN RAISE EXCEPTION 'Solicitud DEMO inválida' USING ERRCODE='22023';END IF;

 -- La escritura se confirma ANTES de consultar cualquier proveedor futuro.
 INSERT INTO mwd_recovery_research.requests(
  actor_alias,request_id,preflight_id,recipient_alias,destination,amount_minor
 ) VALUES(p_actor,p_request,p_preflight,p_recipient,p_destination,p_amount)
 ON CONFLICT(actor_alias,request_id) DO NOTHING RETURNING true INTO inserted;
 SELECT * INTO STRICT v FROM mwd_recovery_research.requests
 WHERE actor_alias=p_actor AND request_id=p_request FOR UPDATE;
 IF v.preflight_id<>p_preflight OR v.recipient_alias<>p_recipient OR
    v.destination<>p_destination OR v.amount_minor<>p_amount
 THEN RAISE EXCEPTION 'Referencia reutilizada con contenido distinto' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object(
  'request_id',v.request_id,'status',v.status,
  'already_processed',inserted IS DISTINCT FROM true,
  'safe_to_submit_again',false,'bank_verified',false,
  'real_money_enabled',false,'ledger_posted',false);
END $$;

CREATE OR REPLACE FUNCTION mwd_recovery_research.inspect_mock_request(
 p_actor text,p_request text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v mwd_recovery_research.requests%rowtype;
BEGIN
 IF p_actor IS NULL OR p_actor !~ '^SIM-[A-Z]{2}-[A-Z0-9]{3,12}$' OR
    p_request IS NULL OR p_request !~ '^[A-Za-z0-9_-]{12,90}$'
 THEN RAISE EXCEPTION 'Referencia DEMO inválida' USING ERRCODE='22023';END IF;
 SELECT * INTO v FROM mwd_recovery_research.requests
 WHERE actor_alias=p_actor AND request_id=p_request;
 RETURN jsonb_build_object(
  'status',CASE WHEN FOUND THEN v.status ELSE 'not_observed_mock' END,
  'request_id',p_request,
  'receipt_order_id',CASE WHEN FOUND THEN v.receipt_order_id ELSE NULL END,
  'safe_to_submit_again',false,'real_money_enabled',false,
  'provider_verified',false,'ledger_posted',false);
END $$;

-- Esta confirmación es un fixture manual, NO una prueba de pago/proveedor.
CREATE OR REPLACE FUNCTION mwd_recovery_research.verify_mock_receipt(
 p_actor text,p_request text,p_receipt uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v mwd_recovery_research.requests%rowtype;
BEGIN
 IF p_receipt IS NULL THEN
  RAISE EXCEPTION 'Recibo ficticio inválido' USING ERRCODE='22023';END IF;
 SELECT * INTO v FROM mwd_recovery_research.requests
 WHERE actor_alias=p_actor AND request_id=p_request FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Reserva ficticia desconocida' USING ERRCODE='22023';END IF;
 IF v.status='verified_mock' THEN
  IF v.receipt_order_id<>p_receipt THEN
   RAISE EXCEPTION 'Recibo distinto para solicitud completada' USING ERRCODE='22023';END IF;
  RETURN jsonb_build_object('status',v.status,'already_processed',true,
   'real_money_enabled',false,'ledger_posted',false);
 END IF;
 UPDATE mwd_recovery_research.requests
 SET status='verified_mock',receipt_order_id=p_receipt
 WHERE actor_alias=p_actor AND request_id=p_request;
 RETURN jsonb_build_object('status','verified_mock','already_processed',false,
  'real_money_enabled',false,'ledger_posted',false);
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA mwd_recovery_research FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_recovery_research FROM PUBLIC,anon,authenticated;
COMMENT ON SCHEMA mwd_recovery_research IS
 'CI desechable sin clientes, fondos, proveedores ni acceso API. Investigación únicamente.';
COMMIT;
