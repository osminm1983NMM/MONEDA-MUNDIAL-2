-- Solamente Postgres ledger_test desechable en GitHub Actions.
DO $$
BEGIN
 IF has_schema_privilege('authenticated','mwd_access_research','USAGE')
 THEN RAISE EXCEPTION 'Riesgo: rol usuario accede a esquema';END IF;
END $$;
SET ROLE mwd_lab_bank_hn;
DO $$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM mwd_access_research.work_items;
 IF n<>2 THEN RAISE EXCEPTION 'Banco HN vio entidades ajenas';END IF;
 BEGIN
 EXECUTE 'SELECT risk_code FROM mwd_access_research.work_items LIMIT 1';
 EXCEPTION WHEN insufficient_privilege THEN RAISE EXCEPTION 'Banco debió ver riesgo ficticio';END;
 BEGIN
 EXECUTE 'SELECT * FROM mwd_access_research.work_items LIMIT 1';
 RAISE EXCEPTION 'Banco recibió acceso a columnas internas';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
INSERT INTO mwd_access_research.review_actions(action_id,case_id,action_code,note_code)
VALUES('11111111-1111-4111-8111-111111111111','SIM-HN-001','request_manual_review_mock','duplicate_mock');
DO $$
BEGIN
 BEGIN
 INSERT INTO mwd_access_research.review_actions(action_id,case_id,action_code,note_code)
 VALUES('22222222-2222-4222-8222-222222222222','SIM-NI-001','request_manual_review_mock','duplicate_mock');
 RAISE EXCEPTION 'Banco HN escribió sobre NI';
 EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;END;
 BEGIN
 INSERT INTO mwd_access_research.review_actions(action_id,case_id,actor_role,action_code,note_code)
 VALUES('33333333-3333-4333-8333-333333333333','SIM-HN-001','mwd_lab_owner','request_manual_review_mock','duplicate_mock');
 RAISE EXCEPTION 'Banco pudo suplantar rol';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SET ROLE mwd_lab_agent_ni;
DO $$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM mwd_access_research.work_items;
 IF n<>2 THEN RAISE EXCEPTION 'Agente NI vio otros países';END IF;
 BEGIN
 EXECUTE 'SELECT amount_minor FROM mwd_access_research.work_items LIMIT 1';
 RAISE EXCEPTION 'Agente vio importe';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
 EXECUTE 'SELECT * FROM mwd_access_research.review_actions';
 RAISE EXCEPTION 'Agente leyó auditoría de otros';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SET ROLE mwd_lab_owner;
DO $$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM mwd_access_research.work_items;
 IF n<>4 THEN RAISE EXCEPTION 'Owner no ve todos los fixtures';END IF;
 SELECT count(*) INTO n FROM mwd_access_research.review_actions;
 IF n<>1 THEN RAISE EXCEPTION 'Auditoría DEMO inesperada';END IF;
 BEGIN
 DELETE FROM mwd_access_research.review_actions;
 RAISE EXCEPTION 'Owner eliminó auditoría';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SELECT 'RLS de entidades ficticias y bitácora de revisiones: OK' AS result;
