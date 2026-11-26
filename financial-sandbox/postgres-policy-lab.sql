-- Disposable PostgreSQL laboratory only. Synthetic compliance fixtures; no real KYC.
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE TABLE actor_policy(
 actor text PRIMARY KEY CHECK(actor ~ '^[A-Za-z0-9_-]{1,100}$'),
 identity text NOT NULL CHECK(identity IN ('verified','pending','blocked')),
 sanctions text NOT NULL CHECK(sanctions IN ('clear','review','blocked')),
 risk text NOT NULL CHECK(risk IN ('allow','review','block')),
 daily_limit bigint NOT NULL CHECK(daily_limit BETWEEN 0 AND 1000000)
);
CREATE TABLE beneficiaries(
 actor text NOT NULL REFERENCES actor_policy(actor),
 reference text NOT NULL CHECK(reference ~ '^[A-Za-z0-9_-]{1,100}$'),
 status text NOT NULL CHECK(status IN ('verified','pending','blocked')),
 PRIMARY KEY(actor,reference)
);
CREATE TABLE quotes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor text NOT NULL REFERENCES actor_policy(actor),
 beneficiary_ref text NOT NULL,
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 100 AND 100000),
 fee_cents bigint GENERATED ALWAYS AS (greatest(100,(amount_cents*150+9999)/10000)) STORED,
 payout_minor bigint GENERATED ALWAYS AS (amount_cents*25) STORED,
 expires_at timestamptz NOT NULL,
 FOREIGN KEY(actor,beneficiary_ref) REFERENCES beneficiaries(actor,reference)
);
CREATE TABLE reservations(
 order_id uuid PRIMARY KEY REFERENCES orders(id),
 quote_id uuid NOT NULL UNIQUE REFERENCES quotes(id),
 actor text NOT NULL REFERENCES actor_policy(actor),
 reserved_day date NOT NULL,
 total_cents bigint NOT NULL CHECK(total_cents>0),
 disclosure_version text NOT NULL CHECK(disclosure_version='sandbox-disclosure-v1'),
 accepted_at timestamptz NOT NULL
);
CREATE INDEX reservations_actor_day ON reservations(actor,reserved_day);
CREATE FUNCTION check_policy(p_actor text,p_beneficiary text) RETURNS bigint
LANGUAGE plpgsql SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE pol actor_policy%ROWTYPE; b beneficiaries%ROWTYPE;
BEGIN
 SELECT * INTO pol FROM actor_policy WHERE actor=p_actor FOR UPDATE;
 IF NOT FOUND OR pol.identity<>'verified' OR pol.sanctions<>'clear' OR pol.risk<>'allow' THEN RAISE EXCEPTION 'COMPLIANCE_HOLD'; END IF;
 SELECT * INTO b FROM beneficiaries WHERE actor=p_actor AND reference=p_beneficiary FOR UPDATE;
 IF NOT FOUND OR b.status<>'verified' THEN RAISE EXCEPTION 'BENEFICIARY_HOLD'; END IF;
 RETURN pol.daily_limit;
END $$;
CREATE FUNCTION issue_quote(p_actor text,p_beneficiary text,p_amount bigint)
RETURNS TABLE(quote_id uuid,amount_cents bigint,fee_cents bigint,total_cents bigint,payout_minor bigint,expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE q quotes%ROWTYPE;
BEGIN
 PERFORM check_policy(p_actor,p_beneficiary);
 INSERT INTO quotes(actor,beneficiary_ref,amount_cents,expires_at)
 VALUES(p_actor,p_beneficiary,p_amount,clock_timestamp()+interval '5 minutes') RETURNING * INTO q;
 RETURN QUERY SELECT q.id,q.amount_cents,q.fee_cents,q.amount_cents+q.fee_cents,q.payout_minor,q.expires_at;
END $$;
CREATE FUNCTION accept_quote(p_actor text,p_request text,p_quote uuid,p_disclosure text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE q quotes%ROWTYPE; pol actor_policy%ROWTYPE; o orders%ROWTYPE; v_limit bigint; v_used numeric; v_now timestamptz; v_day date; v_order uuid;
BEGIN
 IF p_disclosure IS DISTINCT FROM 'sandbox-disclosure-v1' THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
 -- Serialize daily reservations per actor and prevent concurrent consumption of the quote.
 SELECT * INTO pol FROM actor_policy WHERE actor=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMPLIANCE_HOLD'; END IF;
 SELECT * INTO q FROM quotes WHERE id=p_quote AND actor=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'QUOTE_UNAVAILABLE'; END IF;
 SELECT * INTO o FROM orders WHERE actor=p_actor AND request_id=p_request;
 IF FOUND THEN
  IF o.quote_id<>p_quote::text OR NOT EXISTS(SELECT FROM reservations WHERE order_id=o.id AND quote_id=p_quote) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN o.id;
 END IF;
 v_limit:=check_policy(p_actor,q.beneficiary_ref);
 v_now:=clock_timestamp(); v_day:=(v_now AT TIME ZONE 'UTC')::date;
 IF q.expires_at<=v_now OR EXISTS(SELECT FROM reservations WHERE quote_id=q.id) THEN RAISE EXCEPTION 'QUOTE_UNAVAILABLE'; END IF;
 SELECT coalesce(sum(total_cents),0) INTO v_used FROM reservations WHERE actor=p_actor AND reserved_day=v_day;
 IF v_used+q.amount_cents+q.fee_cents>v_limit THEN RAISE EXCEPTION 'DAILY_LIMIT'; END IF;
 v_order:=create_order(p_actor,p_request,q.id::text,q.beneficiary_ref,q.amount_cents);
 INSERT INTO reservations VALUES(v_order,q.id,p_actor,v_day,q.amount_cents+q.fee_cents,p_disclosure,v_now);
 RETURN v_order;
END $$;
CREATE FUNCTION prepare_authorized(p_actor text,p_order uuid,p_kind text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE o orders%ROWTYPE;
BEGIN
 SELECT * INTO o FROM orders WHERE id=p_order AND actor=p_actor;
 IF NOT FOUND OR NOT EXISTS(SELECT FROM reservations WHERE order_id=p_order AND actor=p_actor) THEN RAISE EXCEPTION 'ORDER_UNAVAILABLE'; END IF;
 IF p_kind='payout' THEN PERFORM check_policy(p_actor,o.beneficiary_ref);
 ELSIF p_kind<>'refund' OR p_kind IS NULL THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
 -- Synthetic refund path only: real sanctions/refund policy requires review.
 RETURN prepare_next(p_order,p_kind);
END $$;
-- Remove unguarded entry points; order service is still trusted server, not an end-user role.
REVOKE EXECUTE ON FUNCTION create_order(text,text,text,text,bigint),prepare_next(uuid,text) FROM mwd_lab_order_service;
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_financial_lab FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_financial_lab FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_quote(text,text,bigint),accept_quote(text,text,uuid,text),prepare_authorized(text,uuid,text) TO mwd_lab_order_service;
-- Recheck current synthetic policy when leasing a task; exclude unreserved legacy fixtures.
CREATE OR REPLACE FUNCTION claim_dispatch(p_lease_seconds integer)
RETURNS TABLE(reference text,order_id uuid,kind text,currency text,amount_minor bigint,token uuid,lease_until timestamptz,attempts bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $
DECLARE v_ref text; v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'INVALID_LEASE'; END IF;
 SELECT d.reference INTO v_ref FROM dispatch d
 JOIN outbox x ON x.reference=d.reference
 JOIN orders o ON o.id=x.order_id
 JOIN reservations z ON z.order_id=o.id AND z.actor=o.actor
 JOIN actor_policy pol ON pol.actor=o.actor
 JOIN beneficiaries b ON b.actor=o.actor AND b.reference=o.beneficiary_ref
 WHERE (d.state='queued' OR (d.state='leased' AND d.lease_until<=v_now))
 AND (x.kind='refund' OR (pol.identity='verified' AND pol.sanctions='clear' AND pol.risk='allow' AND b.status='verified'))
 AND o.state=CASE x.kind WHEN 'funding' THEN 'funding_pending' WHEN 'payout' THEN 'payout_pending' WHEN 'refund' THEN 'refund_pending' END
 ORDER BY d.reference LIMIT 1 FOR UPDATE OF d SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE dispatch d SET state='leased',token=gen_random_uuid(),lease_until=v_now+make_interval(secs=>p_lease_seconds),attempts=d.attempts+1 WHERE d.reference=v_ref;
 RETURN QUERY SELECT x.reference,x.order_id,x.kind,x.currency,x.amount_minor,d.token,d.lease_until,d.attempts
 FROM dispatch d JOIN outbox x ON x.reference=d.reference WHERE d.reference=v_ref;
END $;
COMMIT;
