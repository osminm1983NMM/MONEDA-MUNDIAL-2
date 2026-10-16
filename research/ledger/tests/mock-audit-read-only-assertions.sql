-- Read-only owner query against FICTIONAL rows created by earlier CI fixture.
SET ROLE mwd_lab_owner;
DO $$
DECLARE n integer;first_seq bigint;integrity jsonb;
BEGIN
 SELECT count(*) INTO n FROM mwd_access_research.list_mock_review_audit('ALL',0,20);
 IF n<>2 THEN RAISE EXCEPTION 'Consulta propietaria incompleta'; END IF;
 SELECT count(*) INTO n FROM mwd_access_research.list_mock_review_audit('HN',0,20);
 IF n<>2 THEN RAISE EXCEPTION 'Filtro HN inválido'; END IF;
 SELECT count(*) INTO n FROM mwd_access_research.list_mock_review_audit('NI',0,20);
 IF n<>0 THEN RAISE EXCEPTION 'Filtro NI devolvió casos HN'; END IF;
 SELECT max(seq) INTO first_seq FROM mwd_access_research.list_mock_review_audit('HN',0,1);
 SELECT count(*) INTO n FROM mwd_access_research.list_mock_review_audit('HN',first_seq,20);
 IF n<>1 THEN RAISE EXCEPTION 'Paginación inválida'; END IF;
 integrity:=mwd_access_research.verify_mock_review_audit();
 IF integrity->>'integrity_ok_mock'<>'true' THEN RAISE EXCEPTION 'Fallo en cadena'; END IF;
 BEGIN
 PERFORM * FROM mwd_access_research.list_mock_review_audit('ALL',0,999);
 RAISE EXCEPTION 'Límite excesivo permitido';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 UPDATE mwd_access_research.mock_review_audit_entries SET kind='review_expired_mock';
 RAISE EXCEPTION 'Owner pudo alterar bitácora';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SET ROLE mwd_lab_staff_bank_hn;
DO $$
BEGIN
 BEGIN
 PERFORM * FROM mwd_access_research.list_mock_review_audit('HN',0,20);
 RAISE EXCEPTION 'Empleado pudo leer auditoría global';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

DO $$
BEGIN
 IF has_function_privilege('authenticated',
 'mwd_access_research.list_mock_review_audit(text,bigint,integer)','EXECUTE')
 OR has_function_privilege('anon',
 'mwd_access_research.list_mock_review_audit(text,bigint,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'Cliente móvil puede consultar bitácora';END IF;
END $$;

-- Damage only in CI, then roll back: the owner query must FAIL CLOSED.
BEGIN;
UPDATE mwd_access_research.mock_review_audit_head
 SET last_hash=repeat('f',64) WHERE singleton=true;
SET ROLE mwd_lab_owner;
DO $$
BEGIN
 BEGIN
 PERFORM * FROM mwd_access_research.list_mock_review_audit('HN',0,20);
 RAISE EXCEPTION 'La consulta expuso datos ante alteración';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Auditoría en CI: solo propietario, paginación, integridad y aislamiento OK' AS result;
