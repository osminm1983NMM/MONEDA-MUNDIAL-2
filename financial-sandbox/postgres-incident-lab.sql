-- Isolated lab only; normalized authenticated synthetic provider events.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE TABLE event_incidents(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 provider text NOT NULL CHECK(provider='mock-remittance'),
 event_id text NOT NULL CHECK(event_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 reference text NOT NULL,
 prior_reference text,
 outcome text NOT NULL CHECK(outcome IN ('confirmed','failed')),
 currency text NOT NULL CHECK(currency IN ('USD','HNL')),
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 reason text NOT NULL CHECK(reason IN ('UNKNOWN_REFERENCE','EVENT_MISMATCH','EVENT_ID_CONFLICT','UNEXPECTED_EVENT_STATE')),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(provider,event_id,reference,outcome,currency,amount_minor,reason)
);
CREATE TRIGGER incidents_append_only BEFORE UPDATE OR DELETE ON event_incidents FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE FUNCTION record_verified_event(p_provider text,p_event text,p_ref text,p_outcome text,p_currency text,p_amount bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE v_reason text; v_prior text; v_result text;
BEGIN
 IF p_provider IS DISTINCT FROM 'mock-remittance' OR p_event IS NULL OR p_event !~ '^[A-Za-z0-9_-]{1,100}$'
 OR p_ref IS NULL OR p_ref !~ '^[A-Za-z0-9_-]{1,128}$' OR p_outcome IS NULL OR p_outcome NOT IN ('confirmed','failed')
 OR p_currency IS NULL OR p_currency NOT IN ('USD','HNL') OR p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'INVALID_EVENT'; END IF;
 -- Serialize reuse of an event ID across references, including unknown references.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_provider||':'||p_event,0));
 SELECT reference INTO v_prior FROM inbox WHERE provider=p_provider AND event_id=p_event;
 IF NOT EXISTS(SELECT FROM outbox WHERE reference=p_ref) THEN
  v_reason:='UNKNOWN_REFERENCE';
 ELSE
  BEGIN
   v_result:=apply_verified_event(p_provider,p_event,p_ref,p_outcome,p_currency,p_amount);
   RETURN v_result;
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT IN ('EVENT_MISMATCH','EVENT_ID_CONFLICT','UNEXPECTED_EVENT_STATE') THEN RAISE; END IF;
   v_reason:=SQLERRM;
  END;
 END IF;
 INSERT INTO event_incidents(provider,event_id,reference,prior_reference,outcome,currency,amount_minor,reason)
 VALUES(p_provider,p_event,p_ref,v_prior,p_outcome,p_currency,p_amount,v_reason)
 ON CONFLICT(provider,event_id,reference,outcome,currency,amount_minor,reason) DO NOTHING;
 RETURN 'manual_review';
END $$;
CREATE VIEW incident_summary AS SELECT reason,count(*) AS incidents FROM event_incidents GROUP BY reason;
REVOKE EXECUTE ON FUNCTION apply_verified_event(text,text,text,text,text,bigint) FROM mwd_lab_event_service;
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_financial_lab FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_financial_lab FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_verified_event(text,text,text,text,text,bigint) TO mwd_lab_event_service;
GRANT SELECT ON incident_summary TO mwd_lab_audit_service;
CREATE OR REPLACE FUNCTION claim_dispatch(p_lease_seconds integer)
RETURNS TABLE(reference text,order_id uuid,kind text,currency text,amount_minor bigint,token uuid,lease_until timestamptz,attempts bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
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
 AND NOT EXISTS(SELECT FROM event_incidents i LEFT JOIN outbox prior ON prior.reference=i.prior_reference LEFT JOIN outbox incoming ON incoming.reference=i.reference WHERE prior.order_id=o.id OR incoming.order_id=o.id)
 AND o.state=CASE x.kind WHEN 'funding' THEN 'funding_pending' WHEN 'payout' THEN 'payout_pending' WHEN 'refund' THEN 'refund_pending' END
 ORDER BY d.reference LIMIT 1 FOR UPDATE OF d SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE dispatch d SET state='leased',token=gen_random_uuid(),lease_until=v_now+make_interval(secs=>p_lease_seconds),attempts=d.attempts+1 WHERE d.reference=v_ref;
 RETURN QUERY SELECT x.reference,x.order_id,x.kind,x.currency,x.amount_minor,d.token,d.lease_until,d.attempts
 FROM dispatch d JOIN outbox x ON x.reference=d.reference WHERE d.reference=v_ref;
END $$;

COMMIT;
