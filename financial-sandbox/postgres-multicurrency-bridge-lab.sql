-- Explicit synthetic shadow bridge, not a production dispatch path.
BEGIN;
DO $$ BEGIN IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF; END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE TABLE multi_transfer_links(
 transfer_id uuid PRIMARY KEY REFERENCES reservations(order_id),
 multi_id text NOT NULL UNIQUE REFERENCES multi_orders(id),
 CHECK(multi_id=transfer_id::text)
);
CREATE TRIGGER multi_links_append_only BEFORE UPDATE OR DELETE ON multi_transfer_links FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE FUNCTION multi_attach_transfer(p_transfer uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,mwd_financial_lab,pg_temp AS $$
DECLARE o orders%ROWTYPE;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'MULTI_ISOLATION_REQUIRED'; END IF;
 SELECT x.* INTO o FROM orders x JOIN reservations z ON z.order_id=x.id WHERE x.id=p_transfer;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_UNAVAILABLE'; END IF;
 PERFORM multi_create(o.id::text,o.amount_cents,o.fee_cents,o.payout_minor);
 PERFORM 1 FROM multi_orders WHERE id=o.id::text FOR UPDATE;
 IF EXISTS(SELECT FROM multi_transfer_links WHERE transfer_id=p_transfer) THEN RETURN 'duplicate'; END IF;
 IF EXISTS(SELECT FROM multi_events WHERE order_id=o.id::text) THEN RAISE EXCEPTION 'MULTI_HISTORY_EXISTS'; END IF;
 INSERT INTO multi_transfer_links VALUES(o.id,o.id::text);
 RETURN 'attached';
END $$;
CREATE FUNCTION multi_mirror_accepted(p_transfer uuid,p_event text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,mwd_financial_lab,pg_temp AS $$
DECLARE e record;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'MULTI_ISOLATION_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT FROM multi_transfer_links WHERE transfer_id=p_transfer) THEN RAISE EXCEPTION 'TRANSFER_NOT_ATTACHED'; END IF;
 SELECT i.event_id,i.outcome,i.currency,i.amount_minor,x.kind,x.currency AS expected_currency,x.amount_minor AS expected_amount
 INTO e FROM inbox i JOIN outbox x ON x.reference=i.reference
 WHERE i.provider='mock-remittance' AND i.event_id=p_event AND x.order_id=p_transfer;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACCEPTED_EVENT_UNAVAILABLE'; END IF;
 IF (e.currency,e.amount_minor) IS DISTINCT FROM (e.expected_currency,e.expected_amount) THEN RAISE EXCEPTION 'SOURCE_EVENT_MISMATCH'; END IF;
 IF e.kind='refund' AND e.outcome<>'confirmed' THEN RAISE EXCEPTION 'UNSUPPORTED_SOURCE_EVENT'; END IF;
 RETURN multi_apply(p_transfer::text,e.event_id,e.kind||'_'||e.outcome,
  CASE WHEN e.outcome='confirmed' AND e.currency='USD' THEN e.amount_minor END,
  CASE WHEN e.outcome='confirmed' AND e.currency='HNL' THEN e.amount_minor END,NULL);
END $$;
-- The direct fixture endpoint must not bypass accepted-event evidence for a linked order.
-- multi_apply locks the multi order before inserting; attachment uses the same order lock.
CREATE FUNCTION require_multi_source_event() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,mwd_financial_lab,pg_temp AS $
BEGIN
 IF NEW.kind NOT IN ('fx_acquired','fx_unwound') AND EXISTS(
  SELECT FROM multi_transfer_links WHERE multi_id=NEW.order_id
 ) AND NOT EXISTS(
  SELECT FROM multi_transfer_links l JOIN outbox x ON x.order_id=l.transfer_id
  JOIN inbox i ON i.reference=x.reference
  WHERE l.multi_id=NEW.order_id AND i.provider='mock-remittance' AND i.event_id=NEW.id
  AND (i.currency,i.amount_minor) IS NOT DISTINCT FROM (x.currency,x.amount_minor)
  AND (NEW.kind,NEW.usd,NEW.hnl,NEW.cost) IS NOT DISTINCT FROM (
   x.kind||'_'||i.outcome,
   CASE WHEN i.outcome='confirmed' AND i.currency='USD' THEN i.amount_minor END,
   CASE WHEN i.outcome='confirmed' AND i.currency='HNL' THEN i.amount_minor END,
   NULL::bigint
  )
 ) THEN RAISE EXCEPTION 'ACCEPTED_EVENT_REQUIRED'; END IF;
 RETURN NEW;
END $;
CREATE TRIGGER multi_linked_event_evidence BEFORE INSERT ON multi_events
 FOR EACH ROW EXECUTE FUNCTION require_multi_source_event();
REVOKE ALL ON FUNCTION require_multi_source_event() FROM PUBLIC;
-- A read-only comparison checks accepted event identity and payload in both directions.
-- FX events have no source equivalent and are deliberately excluded.
CREATE VIEW multi_transfer_summary AS
WITH expected AS (
 SELECT l.multi_id,i.event_id AS id,x.kind||'_'||i.outcome AS kind,
 CASE WHEN i.outcome='confirmed' AND i.currency='USD' THEN i.amount_minor END AS usd,
 CASE WHEN i.outcome='confirmed' AND i.currency='HNL' THEN i.amount_minor END AS hnl,
 (i.currency,i.amount_minor) IS DISTINCT FROM (x.currency,x.amount_minor) AS source_mismatch
 FROM multi_transfer_links l JOIN outbox x ON x.order_id=l.transfer_id JOIN inbox i ON i.reference=x.reference
 WHERE i.provider='mock-remittance'
), actual AS (
 SELECT e.* FROM multi_events e JOIN multi_transfer_links l ON l.multi_id=e.order_id
 WHERE e.kind NOT IN ('fx_acquired','fx_unwound')
), differences AS (
 SELECT coalesce(x.multi_id,a.order_id) AS multi_id
 FROM expected x FULL JOIN actual a ON a.id=x.id AND a.order_id=x.multi_id
 WHERE x.id IS NULL OR a.id IS NULL OR x.source_mismatch OR
 (x.kind,x.usd,x.hnl,NULL::bigint) IS DISTINCT FROM (a.kind,a.usd,a.hnl,a.cost)
)
SELECT count(*) AS linked_transfers,
 count(*) FILTER (WHERE o.state IN ('paid','refunded','funding_failed') AND o.state IS DISTINCT FROM m.state) AS terminal_state_mismatches,
 (SELECT count(*) FROM differences) AS event_discrepancies
FROM multi_transfer_links l JOIN orders o ON o.id=l.transfer_id JOIN multi_orders m ON m.id=l.multi_id;
REVOKE ALL ON multi_transfer_links,multi_transfer_summary FROM PUBLIC;
REVOKE ALL ON FUNCTION multi_attach_transfer(uuid),multi_mirror_accepted(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION multi_attach_transfer(uuid) TO mwd_lab_multi_order;
GRANT EXECUTE ON FUNCTION multi_mirror_accepted(uuid,text) TO mwd_lab_multi_event;
GRANT SELECT ON multi_transfer_summary TO mwd_lab_audit_service;
COMMIT;
