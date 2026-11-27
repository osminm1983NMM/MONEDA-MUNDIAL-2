-- Synthetic USD/HNL ledger, independent of the existing USD lab.
BEGIN;
DO $$ BEGIN IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF; END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE ROLE mwd_lab_multi_order NOLOGIN;
CREATE ROLE mwd_lab_multi_event NOLOGIN;
GRANT USAGE ON SCHEMA mwd_financial_lab TO mwd_lab_multi_order,mwd_lab_multi_event;
CREATE TABLE multi_orders(
 id text PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{1,100}$'),
 principal bigint NOT NULL CHECK(principal BETWEEN 1 AND 9007199254740991),
 fee bigint NOT NULL CHECK(fee BETWEEN 0 AND 9007199254740991),
 payout bigint NOT NULL CHECK(payout BETWEEN 1 AND 9007199254740991),
 state text NOT NULL DEFAULT 'awaiting_funding' CHECK(state IN ('awaiting_funding','funding_failed','funded','fx_acquired','paid','payout_failed_converted','payout_failed_unconverted','refunded')),
 CHECK(principal+fee<=9007199254740991)
);
CREATE TABLE multi_events(
 id text PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{1,100}$'),
 order_id text NOT NULL REFERENCES multi_orders(id),
 kind text NOT NULL,
 usd bigint, hnl bigint, cost bigint,
 UNIQUE(id,order_id),
 CHECK(usd IS NULL OR usd BETWEEN 1 AND 9007199254740991),
 CHECK(hnl IS NULL OR hnl BETWEEN 1 AND 9007199254740991),
 CHECK(cost IS NULL OR cost BETWEEN 0 AND 9007199254740991),
 CHECK(CASE kind
  WHEN 'funding_confirmed' THEN usd IS NOT NULL AND hnl IS NULL AND cost IS NULL
  WHEN 'funding_failed' THEN usd IS NULL AND hnl IS NULL AND cost IS NULL
  WHEN 'fx_acquired' THEN usd IS NOT NULL AND hnl IS NOT NULL AND cost IS NOT NULL
  WHEN 'payout_confirmed' THEN usd IS NULL AND hnl IS NOT NULL AND cost IS NULL
  WHEN 'payout_failed' THEN usd IS NULL AND hnl IS NULL AND cost IS NULL
  WHEN 'fx_unwound' THEN usd IS NOT NULL AND hnl IS NOT NULL AND cost IS NOT NULL
  WHEN 'refund_confirmed' THEN usd IS NOT NULL AND hnl IS NULL AND cost IS NULL
  ELSE false END)
);
CREATE TABLE multi_journal(
 event_id text NOT NULL,order_id text NOT NULL,currency text NOT NULL CHECK(currency IN ('USD','HNL')),
 cash bigint NOT NULL,payable bigint NOT NULL,bridge bigint NOT NULL,revenue bigint NOT NULL,expense bigint NOT NULL,
 PRIMARY KEY(event_id,currency), FOREIGN KEY(event_id,order_id) REFERENCES multi_events(id,order_id),
 CHECK(cash::numeric+payable+bridge+revenue+expense=0),
 CHECK(cash<>0 OR payable<>0 OR bridge<>0 OR revenue<>0 OR expense<>0),
 CHECK(currency='USD' OR (payable=0 AND revenue=0 AND expense=0))
);
CREATE TRIGGER multi_events_append_only BEFORE UPDATE OR DELETE ON multi_events FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE TRIGGER multi_journal_append_only BEFORE UPDATE OR DELETE ON multi_journal FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE FUNCTION multi_create(p_id text,p_principal bigint,p_fee bigint,p_payout bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,mwd_financial_lab,pg_temp AS $$
DECLARE o multi_orders%ROWTYPE;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'MULTI_ISOLATION_REQUIRED'; END IF;
 INSERT INTO multi_orders(id,principal,fee,payout) VALUES(p_id,p_principal,p_fee,p_payout)
 ON CONFLICT(id) DO NOTHING RETURNING * INTO o;
 IF FOUND THEN RETURN 'created'; END IF;
 SELECT * INTO STRICT o FROM multi_orders WHERE id=p_id;
 IF (o.principal,o.fee,o.payout) IS DISTINCT FROM (p_principal,p_fee,p_payout) THEN RAISE EXCEPTION 'ORDER_ID_CONFLICT'; END IF;
 RETURN 'duplicate';
END $$;
CREATE FUNCTION multi_apply(p_id text,p_event text,p_kind text,p_usd bigint,p_hnl bigint,p_cost bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,mwd_financial_lab,pg_temp AS $$
DECLARE o multi_orders%ROWTYPE; prior multi_events%ROWTYPE; total bigint; next_state text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'MULTI_ISOLATION_REQUIRED'; END IF;
 IF p_event IS NULL OR p_event !~ '^[A-Za-z0-9_-]{1,100}$' THEN RAISE EXCEPTION 'INVALID_EVENT'; END IF;
 -- Stable global event lock before per-order lock. Cross-order ID reuse cannot race.
 PERFORM pg_advisory_xact_lock(hashtextextended('mwd-multi-event:'||p_event,0));
 SELECT * INTO prior FROM multi_events WHERE id=p_event;
 IF FOUND THEN
  IF (prior.order_id,prior.kind,prior.usd,prior.hnl,prior.cost) IS DISTINCT FROM (p_id,p_kind,p_usd,p_hnl,p_cost) THEN RAISE EXCEPTION 'EVENT_ID_CONFLICT'; END IF;
  RETURN 'duplicate';
 END IF;
 SELECT * INTO STRICT o FROM multi_orders WHERE id=p_id FOR UPDATE;
 total:=o.principal+o.fee;
 -- Shape/amount range checked before any posting; exceptions roll back event and state.
 INSERT INTO multi_events VALUES(p_event,p_id,p_kind,p_usd,p_hnl,p_cost);
 CASE p_kind
 WHEN 'funding_confirmed' THEN
  IF o.state<>'awaiting_funding' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF p_usd<>total THEN RAISE EXCEPTION 'AMOUNT_MISMATCH'; END IF;
  INSERT INTO multi_journal VALUES(p_event,p_id,'USD',total,-total,0,0,0); next_state:='funded';
 WHEN 'funding_failed' THEN
  IF o.state<>'awaiting_funding' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  next_state:='funding_failed';
 WHEN 'fx_acquired' THEN
  IF o.state<>'funded' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF p_usd<>o.principal OR p_hnl<>o.payout THEN RAISE EXCEPTION 'AMOUNT_MISMATCH'; END IF;
  INSERT INTO multi_journal VALUES(p_event,p_id,'USD',-o.principal-p_cost,0,o.principal,0,p_cost),
   (p_event,p_id,'HNL',o.payout,0,-o.payout,0,0); next_state:='fx_acquired';
 WHEN 'payout_confirmed' THEN
  IF o.state<>'fx_acquired' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF p_hnl<>o.payout THEN RAISE EXCEPTION 'AMOUNT_MISMATCH'; END IF;
  INSERT INTO multi_journal VALUES(p_event,p_id,'HNL',-o.payout,0,o.payout,0,0),
   (p_event,p_id,'USD',0,total,-o.principal,-o.fee,0); next_state:='paid';
 WHEN 'payout_failed' THEN
  IF o.state NOT IN ('funded','fx_acquired') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  next_state:=CASE WHEN o.state='funded' THEN 'payout_failed_unconverted' ELSE 'payout_failed_converted' END;
 WHEN 'fx_unwound' THEN
  IF o.state<>'payout_failed_converted' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF p_usd<>o.principal OR p_hnl<>o.payout THEN RAISE EXCEPTION 'AMOUNT_MISMATCH'; END IF;
  INSERT INTO multi_journal VALUES(p_event,p_id,'HNL',-o.payout,0,o.payout,0,0),
   (p_event,p_id,'USD',o.principal-p_cost,0,-o.principal,0,p_cost); next_state:='payout_failed_unconverted';
 WHEN 'refund_confirmed' THEN
  IF o.state<>'payout_failed_unconverted' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF p_usd<>total THEN RAISE EXCEPTION 'AMOUNT_MISMATCH'; END IF;
  INSERT INTO multi_journal VALUES(p_event,p_id,'USD',-total,total,0,0,0); next_state:='refunded';
 ELSE RAISE EXCEPTION 'INVALID_EVENT';
 END CASE;
 UPDATE multi_orders SET state=next_state WHERE id=p_id;
 RETURN next_state;
END $$;
CREATE VIEW multi_balance_summary AS
 SELECT c.currency,coalesce(sum(j.cash),0) AS cash,coalesce(sum(j.payable),0) AS payable,
 coalesce(sum(j.bridge),0) AS bridge,coalesce(sum(j.revenue),0) AS revenue,coalesce(sum(j.expense),0) AS expense
 FROM (VALUES ('USD'),('HNL')) c(currency) LEFT JOIN multi_journal j ON j.currency=c.currency GROUP BY c.currency;
REVOKE ALL ON multi_orders,multi_events,multi_journal,multi_balance_summary FROM PUBLIC;
REVOKE ALL ON FUNCTION multi_create(text,bigint,bigint,bigint),multi_apply(text,text,text,bigint,bigint,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION multi_create(text,bigint,bigint,bigint) TO mwd_lab_multi_order;
GRANT EXECUTE ON FUNCTION multi_apply(text,text,text,bigint,bigint,bigint) TO mwd_lab_multi_event;
GRANT SELECT ON multi_balance_summary TO mwd_lab_audit_service;
COMMIT;
