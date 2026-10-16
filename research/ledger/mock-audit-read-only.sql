-- MONEDA MUNDIAL 2.0: lectura administrativa de auditoría DEMO.
-- ONLY Postgres 16 CI ledger_test. Never install in Supabase/production.
-- Data consists solely of synthetically generated cases and aliases.
-- No endpoints, JWT, PII, bank records, funds or privileged actions.

-- The owner may inspect audit metadata and verify the chain, not mutate it.
-- Never grant rights to application roles (anon/authenticated).
GRANT SELECT ON mwd_access_research.mock_review_audit_head TO mwd_lab_owner;
GRANT EXECUTE ON FUNCTION mwd_access_research.mock_review_hash(
 bigint,uuid,uuid,text,text,text,text,text,text,timestamptz,text)
 TO mwd_lab_owner;
GRANT EXECUTE ON FUNCTION mwd_access_research.verify_mock_review_audit()
 TO mwd_lab_owner;

CREATE OR REPLACE FUNCTION mwd_access_research.list_mock_review_audit(
 p_country text DEFAULT 'ALL',
 p_after_seq bigint DEFAULT 0,
 p_limit integer DEFAULT 20
) RETURNS TABLE(
  seq bigint,case_id text,institution_id text,actor_alias text,
  event_kind text,review_status text,recorded_at timestamptz
) LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_integrity jsonb;
BEGIN
  IF p_country IS NULL OR p_country NOT IN ('ALL','HN','NI')
    OR p_after_seq IS NULL OR p_after_seq<0
    OR p_limit IS NULL OR p_limit<1 OR p_limit>50 THEN
     RAISE EXCEPTION 'Consulta de auditoría de laboratorio inválida'
       USING ERRCODE='22023';
  END IF;
  -- Fail closed if any row or the head of the chain appears altered.
  -- This is not WORM and a database owner could rewrite the whole chain.
  v_integrity:=mwd_access_research.verify_mock_review_audit();
  IF v_integrity->>'integrity_ok_mock'<>'true' THEN
    RAISE EXCEPTION 'Integridad de bitácora ficticia no comprobada'
      USING ERRCODE='22023';
  END IF;
  RETURN QUERY
   SELECT e.seq,e.case_id,e.institution_id,e.actor_alias,
          e.kind,e.state,e.recorded_at
   FROM mwd_access_research.mock_review_audit_entries e
   JOIN mwd_access_research.work_items w ON w.case_id=e.case_id
   WHERE e.seq>p_after_seq
     AND (p_country='ALL' OR w.country_code=p_country)
   ORDER BY e.seq ASC LIMIT p_limit;
END $$;

REVOKE ALL ON FUNCTION mwd_access_research.list_mock_review_audit(
 text,bigint,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mwd_access_research.list_mock_review_audit(
 text,bigint,integer) TO mwd_lab_owner;
COMMENT ON FUNCTION mwd_access_research.list_mock_review_audit(
 text,bigint,integer) IS
'READ ONLY: owner role of temporary CI fixture, integrity gate, cursor pagination, no money and no external users.';
