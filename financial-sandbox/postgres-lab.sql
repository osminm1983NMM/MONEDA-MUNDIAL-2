-- PostgreSQL 17 disposable laboratory only. No Supabase deployment.
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
CREATE SCHEMA mwd_financial_lab;
REVOKE ALL ON SCHEMA mwd_financial_lab FROM PUBLIC;
SET LOCAL search_path = mwd_financial_lab, pg_catalog;
CREATE TABLE orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor text NOT NULL CHECK(actor ~ '^[A-Za-z0-9_-]{1,100}$'),
 request_id text NOT NULL CHECK(request_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 quote_id text NOT NULL UNIQUE CHECK(quote_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 beneficiary_ref text NOT NULL CHECK(beneficiary_ref ~ '^[A-Za-z0-9_-]{1,100}$'),
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 100 AND 100000),
 fee_cents bigint GENERATED ALWAYS AS (greatest(100,(amount_cents*150+9999)/10000)) STORED,
 payout_minor bigint GENERATED ALWAYS AS (amount_cents*25) STORED,
 state text NOT NULL CHECK(state IN ('funding_pending','funding_failed','funded','payout_pending','payout_failed','paid','refund_pending','refunded')),
 UNIQUE(actor,request_id)
);
CREATE TABLE outbox (
 reference text PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES orders(id),
 kind text NOT NULL CHECK(kind IN ('funding','payout','refund')),
 currency text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 UNIQUE(order_id,kind),
 CHECK(currency=CASE WHEN kind='payout' THEN 'HNL' ELSE 'USD' END),
 CHECK(reference=order_id::text||'-'||kind)
);
CREATE TABLE inbox (
 provider text NOT NULL CHECK(provider='mock-remittance'),
 event_id text NOT NULL CHECK(event_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 reference text NOT NULL REFERENCES outbox(reference),
 outcome text NOT NULL CHECK(outcome IN ('confirmed','failed')),
 currency text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 PRIMARY KEY(provider,event_id)
);
-- Reconciliation and order integrity look up accepted events by transfer reference.
CREATE INDEX inbox_reference_outcome_idx ON inbox(reference,outcome);
CREATE TABLE journal (
 provider text NOT NULL,
 event_id text NOT NULL,
 order_id uuid NOT NULL REFERENCES orders(id),
 cash bigint NOT NULL,
 payable bigint NOT NULL,
 revenue bigint NOT NULL,
 PRIMARY KEY(provider,event_id),
 FOREIGN KEY(provider,event_id) REFERENCES inbox(provider,event_id),
 CHECK(cash+payable+revenue=0),
 CHECK(cash<>0 OR payable<>0 OR revenue<>0)
);
CREATE FUNCTION deny_journal_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'APPEND_ONLY'; END $$;
CREATE TRIGGER journal_append_only BEFORE UPDATE OR DELETE ON journal FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
-- Trusted synthetic server input only: no authentication, quote issuance or KYC here.
CREATE FUNCTION create_order(p_actor text,p_request text,p_quote text,p_beneficiary text,p_amount bigint)
RETURNS uuid LANGUAGE plpgsql SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE o orders%ROWTYPE;
BEGIN
 INSERT INTO orders(actor,request_id,quote_id,beneficiary_ref,amount_cents,state)
 VALUES(p_actor,p_request,p_quote,p_beneficiary,p_amount,'funding_pending')
 ON CONFLICT(actor,request_id) DO NOTHING RETURNING * INTO o;
 IF NOT FOUND THEN
  SELECT * INTO STRICT o FROM orders WHERE actor=p_actor AND request_id=p_request FOR UPDATE;
  IF (o.quote_id,o.beneficiary_ref,o.amount_cents) IS DISTINCT FROM (p_quote,p_beneficiary,p_amount) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN o.id;
 END IF;
 INSERT INTO outbox VALUES(o.id::text||'-funding',o.id,'funding','USD',o.amount_cents+o.fee_cents);
 RETURN o.id;
END $$;
-- Called only after trusted policy checks; refund requires definitive payout failure.
CREATE FUNCTION prepare_next(p_order uuid,p_kind text) RETURNS text
LANGUAGE plpgsql SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE o orders%ROWTYPE; ref text;
BEGIN
 SELECT * INTO STRICT o FROM orders WHERE id=p_order FOR UPDATE;
 IF p_kind='payout' AND o.state IN ('funded','payout_pending') THEN
  ref:=o.id::text||'-payout';
  INSERT INTO outbox VALUES(ref,o.id,'payout','HNL',o.payout_minor) ON CONFLICT(reference) DO NOTHING;
  UPDATE orders SET state='payout_pending' WHERE id=o.id;
 ELSIF p_kind='refund' AND o.state IN ('payout_failed','refund_pending') THEN
  ref:=o.id::text||'-refund';
  INSERT INTO outbox VALUES(ref,o.id,'refund','USD',o.amount_cents+o.fee_cents) ON CONFLICT(reference) DO NOTHING;
  UPDATE orders SET state='refund_pending' WHERE id=o.id;
 ELSE RAISE EXCEPTION 'INVALID_TRANSITION';
 END IF;
 RETURN ref;
END $$;
-- Signature verification belongs to the trusted server. Only normalized synthetic input.
-- One transaction: event deduplication + order state + posting; errors roll all back.
CREATE FUNCTION apply_verified_event(p_provider text,p_event text,p_ref text,p_outcome text,p_currency text,p_amount bigint)
RETURNS text LANGUAGE plpgsql SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE e inbox%ROWTYPE; x outbox%ROWTYPE; o orders%ROWTYPE; next_state text; c bigint:=0; p bigint:=0; r bigint:=0; total bigint;
BEGIN
 INSERT INTO inbox VALUES(p_provider,p_event,p_ref,p_outcome,p_currency,p_amount)
 ON CONFLICT(provider,event_id) DO NOTHING RETURNING * INTO e;
 IF NOT FOUND THEN
  SELECT * INTO STRICT e FROM inbox WHERE provider=p_provider AND event_id=p_event;
  IF (e.reference,e.outcome,e.currency,e.amount_minor) IS DISTINCT FROM (p_ref,p_outcome,p_currency,p_amount) THEN RAISE EXCEPTION 'EVENT_ID_CONFLICT'; END IF;
  RETURN 'duplicate';
 END IF;
 SELECT * INTO STRICT x FROM outbox WHERE reference=p_ref;
 IF (x.currency,x.amount_minor) IS DISTINCT FROM (p_currency,p_amount) THEN RAISE EXCEPTION 'EVENT_MISMATCH'; END IF;
 SELECT * INTO STRICT o FROM orders WHERE id=x.order_id FOR UPDATE;
 total:=o.amount_cents+o.fee_cents;
 IF x.kind='funding' AND o.state='funding_pending' THEN
  IF p_outcome='confirmed' THEN next_state:='funded'; c:=total; p:=-total;
  ELSE next_state:='funding_failed'; END IF;
 ELSIF x.kind='payout' AND o.state='payout_pending' THEN
  IF p_outcome='confirmed' THEN next_state:='paid'; c:=-o.amount_cents; p:=total; r:=-o.fee_cents;
  ELSE next_state:='payout_failed'; END IF;
 ELSIF x.kind='refund' AND o.state='refund_pending' AND p_outcome='confirmed' THEN
  next_state:='refunded'; c:=-total; p:=total;
 ELSE RAISE EXCEPTION 'UNEXPECTED_EVENT_STATE';
 END IF;
 IF c<>0 OR p<>0 OR r<>0 THEN INSERT INTO journal VALUES(p_provider,p_event,o.id,c,p,r); END IF;
 UPDATE orders SET state=next_state WHERE id=o.id;
 RETURN next_state;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_financial_lab FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_financial_lab FROM PUBLIC;
COMMIT;
