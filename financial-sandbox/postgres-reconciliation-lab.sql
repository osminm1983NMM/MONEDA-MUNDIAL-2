-- Disposable financial reconciliation laboratory. No real statements or settlement.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE ROLE mwd_lab_statement_service NOLOGIN;
CREATE TABLE statement_batches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 external_id text NOT NULL UNIQUE CHECK(external_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 complete boolean NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='array')
);
CREATE TABLE statement_internal(
 batch_id uuid NOT NULL REFERENCES statement_batches(id),
 reference text NOT NULL,
 kind text NOT NULL,
 currency text NOT NULL,
 amount_minor bigint NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','confirmed','failed')),
 PRIMARY KEY(batch_id,reference)
);
CREATE TABLE statement_external(
 batch_id uuid NOT NULL REFERENCES statement_batches(id),
 row_number bigint NOT NULL,
 reference text NOT NULL CHECK(reference ~ '^[A-Za-z0-9_-]{1,128}$'),
 kind text NOT NULL CHECK(kind IN ('funding','payout','refund')),
 currency text NOT NULL CHECK(currency IN ('USD','HNL')),
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 status text NOT NULL CHECK(status IN ('pending','confirmed','failed')),
 PRIMARY KEY(batch_id,row_number),
 CHECK(currency=CASE WHEN kind='payout' THEN 'HNL' ELSE 'USD' END)
);
CREATE TRIGGER batch_append_only BEFORE UPDATE OR DELETE ON statement_batches FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE TRIGGER internal_append_only BEFORE UPDATE OR DELETE ON statement_internal FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE TRIGGER external_append_only BEFORE UPDATE OR DELETE ON statement_external FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
CREATE FUNCTION import_statement(p_external_id text,p_complete boolean,p_rows jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE b statement_batches%ROWTYPE;
BEGIN
 IF p_external_id IS NULL OR p_external_id !~ '^[A-Za-z0-9_-]{1,100}$' OR p_complete IS NULL OR p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' THEN RAISE EXCEPTION 'INVALID_STATEMENT'; END IF;
 IF jsonb_array_length(p_rows)>10000 OR octet_length(p_rows::text)>4000000 THEN RAISE EXCEPTION 'STATEMENT_TOO_LARGE'; END IF;
 -- Strict synthetic normalized rows, no additional metadata or sensitive data.
 IF EXISTS(SELECT FROM jsonb_array_elements(p_rows) e(v) WHERE
 jsonb_typeof(v)<>'object' OR NOT (v ?& ARRAY['mode','reference','kind','currency','amountMinor','status'])
 OR v->>'mode' IS DISTINCT FROM 'sandbox' OR jsonb_typeof(v->'amountMinor') IS DISTINCT FROM 'number'
 OR (v->>'amountMinor') !~ '^[1-9][0-9]{0,15}$'
 OR (v-ARRAY['mode','reference','kind','currency','amountMinor','status'])<>'{}'::jsonb)
 THEN RAISE EXCEPTION 'INVALID_STATEMENT_ROW'; END IF;
 INSERT INTO statement_batches(external_id,complete,payload) VALUES(p_external_id,p_complete,p_rows)
 ON CONFLICT(external_id) DO NOTHING RETURNING * INTO b;
 IF NOT FOUND THEN
  SELECT * INTO STRICT b FROM statement_batches WHERE external_id=p_external_id;
  IF (b.complete,b.payload) IS DISTINCT FROM (p_complete,p_rows) THEN RAISE EXCEPTION 'STATEMENT_ID_CONFLICT'; END IF;
  RETURN b.id;
 END IF;
 -- Single statement snapshot of all reserved lab outbox references. No reconstruction of provider data.
 INSERT INTO statement_internal
 SELECT b.id,x.reference,x.kind,x.currency,x.amount_minor,
 CASE WHEN EXISTS(SELECT FROM inbox e WHERE e.reference=x.reference AND e.outcome='confirmed') THEN 'confirmed'
 WHEN EXISTS(SELECT FROM inbox e WHERE e.reference=x.reference AND e.outcome='failed') THEN 'failed' ELSE 'pending' END
 FROM outbox x JOIN reservations z ON z.order_id=x.order_id;
 INSERT INTO statement_external
 SELECT b.id,n,v->>'reference',v->>'kind',v->>'currency',(v->>'amountMinor')::bigint,v->>'status'
 FROM jsonb_array_elements(p_rows) WITH ORDINALITY e(v,n);
 RETURN b.id;
END $$;
CREATE VIEW reconciliation_details AS
WITH ext AS (
 SELECT batch_id,reference,count(*) AS copies,min(kind) AS kind,min(currency) AS currency,
 min(amount_minor) AS amount_minor,min(status) AS status
 FROM statement_external GROUP BY batch_id,reference
)
SELECT coalesce(i.batch_id,e.batch_id) AS batch_id,coalesce(i.reference,e.reference) AS reference,
 CASE WHEN e.copies>1 THEN 'DUPLICATE_REFERENCE'
 WHEN i.reference IS NULL THEN 'UNKNOWN_PROVIDER'
 WHEN e.reference IS NULL THEN 'MISSING_PROVIDER'
 WHEN (i.kind,i.currency,i.amount_minor) IS DISTINCT FROM (e.kind,e.currency,e.amount_minor) THEN 'VALUE_MISMATCH'
 WHEN i.status<>e.status THEN 'STATUS_MISMATCH'
 WHEN i.status='pending' THEN 'UNRESOLVED_PENDING'
 WHEN i.status='confirmed' THEN 'MATCHED_CONFIRMED' ELSE 'MATCHED_FAILED' END AS result,
 i.currency AS internal_currency,i.amount_minor AS internal_amount_minor,i.kind AS internal_kind
 FROM statement_internal i FULL OUTER JOIN ext e ON e.batch_id=i.batch_id AND e.reference=i.reference;
CREATE VIEW reconciliation_summary AS
SELECT b.id AS batch_id,b.complete,b.captured_at,
 count(d.reference) FILTER(WHERE d.result NOT IN ('MATCHED_CONFIRMED','MATCHED_FAILED')) AS discrepancy_count,
 (b.complete AND count(d.reference) FILTER(WHERE d.result NOT IN ('MATCHED_CONFIRMED','MATCHED_FAILED'))=0) AS clean,
 coalesce(sum(CASE WHEN d.internal_kind='funding' THEN d.internal_amount_minor ELSE -d.internal_amount_minor END)
 FILTER(WHERE d.result='MATCHED_CONFIRMED' AND d.internal_currency='USD'),0) AS matched_usd_minor,
 coalesce(sum(-d.internal_amount_minor) FILTER(WHERE d.result='MATCHED_CONFIRMED' AND d.internal_currency='HNL'),0) AS matched_hnl_minor
 FROM statement_batches b LEFT JOIN reconciliation_details d ON d.batch_id=b.id GROUP BY b.id;
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_financial_lab FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_financial_lab FROM PUBLIC;
GRANT USAGE ON SCHEMA mwd_financial_lab TO mwd_lab_statement_service;
GRANT EXECUTE ON FUNCTION import_statement(text,boolean,jsonb) TO mwd_lab_statement_service;
GRANT SELECT ON reconciliation_summary TO mwd_lab_audit_service;
-- No dispatch, journal, approval, or event privileges granted to statement service.
COMMIT;
