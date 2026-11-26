-- Disposable laboratory only. Full-history provider snapshot with explicit as-of metadata.
BEGIN;
DO $$ BEGIN IF current_database()<>'mwd_financial_sandbox_test' THEN RAISE EXCEPTION 'ISOLATED_DATABASE_REQUIRED'; END IF; END $$;
SET LOCAL search_path=mwd_financial_lab,pg_catalog;
CREATE TABLE statement_cut_metadata(
 batch_id uuid PRIMARY KEY REFERENCES statement_batches(id),
 scope text NOT NULL CHECK(scope='US-HN:all-funding-payout-refund'),
 provider_as_of timestamptz NOT NULL CHECK(isfinite(provider_as_of)),
 declared_count integer NOT NULL CHECK(declared_count BETWEEN 0 AND 10000),
 imported_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER statement_cut_append_only BEFORE UPDATE OR DELETE ON statement_cut_metadata
 FOR EACH ROW EXECUTE FUNCTION deny_journal_mutation();
-- One bounded count backs both the import gate and audit capacity reporting.
CREATE VIEW reconciliation_capacity_summary AS
WITH limits AS (SELECT 10000 AS reference_limit),
observed AS (
 SELECT count(*) AS references_seen FROM (
  SELECT 1 FROM outbox x JOIN reservations z ON z.order_id=x.order_id
  LIMIT ((SELECT reference_limit FROM limits)+1)
 ) AS bounded_references
)
SELECT reference_limit,
 greatest(reference_limit-references_seen,0) AS references_remaining,
 references_seen>reference_limit AS capacity_exceeded
FROM limits CROSS JOIN observed;
CREATE FUNCTION import_statement_cut(p_external_id text,p_scope text,p_as_of timestamptz,p_count integer,p_rows jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=mwd_financial_lab,pg_catalog AS $$
DECLARE b uuid; prior statement_cut_metadata%ROWTYPE; now_at timestamptz; max_rows constant integer:=10000;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'CUT_ISOLATION_REQUIRED'; END IF;
 IF p_scope IS DISTINCT FROM 'US-HN:all-funding-payout-refund' OR p_as_of IS NULL OR NOT isfinite(p_as_of)
 OR p_count IS NULL OR p_count NOT BETWEEN 0 AND max_rows OR p_rows IS NULL OR jsonb_typeof(p_rows)<>'array'
 THEN RAISE EXCEPTION 'INVALID_CUT_ENVELOPE'; END IF;
 IF jsonb_array_length(p_rows)<>p_count THEN RAISE EXCEPTION 'CUT_COUNT_MISMATCH'; END IF;
 PERFORM pg_advisory_xact_lock(60261126,17);
 -- Idempotent replay checks metadata as well as payload; never attach new metadata to a legacy batch.
 SELECT id INTO b FROM statement_batches WHERE external_id=p_external_id;
 IF FOUND THEN
  SELECT * INTO prior FROM statement_cut_metadata WHERE batch_id=b;
  IF NOT FOUND OR (prior.scope,prior.provider_as_of,prior.declared_count) IS DISTINCT FROM (p_scope,p_as_of,p_count)
  THEN RAISE EXCEPTION 'CUT_ID_CONFLICT'; END IF;
  RETURN import_statement(p_external_id,true,p_rows);
 END IF;
 now_at:=clock_timestamp();
 -- A full current universe, not a historical reconstruction. Synthetic maximum age: 60 seconds.
 IF p_as_of>now_at OR p_as_of<now_at-interval '60 seconds' THEN RAISE EXCEPTION 'CUT_NOT_CURRENT'; END IF;
 IF EXISTS(SELECT FROM statement_cut_metadata WHERE provider_as_of>=p_as_of)
 THEN RAISE EXCEPTION 'CUT_NOT_ADVANCING'; END IF;
 BEGIN
  LOCK TABLE outbox,reservations,inbox IN SHARE MODE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'CUT_EVIDENCE_BUSY'; END;
 -- The full-history envelope cannot represent a larger internal universe.
 -- Check under the same locks used to capture that universe.
 IF (SELECT capacity_exceeded FROM reconciliation_capacity_summary)
 THEN RAISE EXCEPTION 'CUT_CAPACITY_EXCEEDED'; END IF;
 b:=import_statement(p_external_id,true,p_rows);
 INSERT INTO statement_cut_metadata(batch_id,scope,provider_as_of,declared_count) VALUES(b,p_scope,p_as_of,p_count);
 RETURN b;
END $$;
-- A clean legacy reconciliation is not a validated cut.
CREATE VIEW reconciliation_cut_summary AS
 SELECT s.batch_id,s.captured_at,m.provider_as_of,m.scope,m.declared_count,
 s.discrepancy_count,(m.batch_id IS NOT NULL AND s.clean) AS clean,
 CASE WHEN m.batch_id IS NOT NULL AND s.clean THEN s.matched_usd_minor END AS matched_usd_minor,
 CASE WHEN m.batch_id IS NOT NULL AND s.clean THEN s.matched_hnl_minor END AS matched_hnl_minor
 FROM reconciliation_summary s LEFT JOIN statement_cut_metadata m ON m.batch_id=s.batch_id;
REVOKE ALL ON statement_cut_metadata,reconciliation_cut_summary,reconciliation_capacity_summary FROM PUBLIC;
REVOKE ALL ON FUNCTION import_statement_cut(text,text,timestamptz,integer,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION import_statement(text,boolean,jsonb) FROM mwd_lab_statement_service;
GRANT EXECUTE ON FUNCTION import_statement_cut(text,text,timestamptz,integer,jsonb) TO mwd_lab_statement_service;
GRANT SELECT ON reconciliation_cut_summary,reconciliation_capacity_summary TO mwd_lab_audit_service;
COMMIT;
