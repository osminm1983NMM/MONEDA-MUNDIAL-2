-- Ejercicios de auditoría con información 100% ficticia. CI postgres 16.
DO $$
DECLARE x jsonb;y jsonb;n bigint;
BEGIN
 x:=mwd_access_research.append_mock_review_audit(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SIM-HN-001',
 'bank-hn','mock-reviewer-a1','review_created_mock','bank_payout');
 IF x->>'already_processed'<>'false' THEN RAISE EXCEPTION 'Primer evento inválido';END IF;
 y:=mwd_access_research.append_mock_review_audit(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SIM-HN-001',
 'bank-hn','mock-reviewer-a1','review_created_mock','bank_payout');
 IF y->>'already_processed'<>'true' THEN RAISE EXCEPTION 'Idempotencia falló'; END IF;
 BEGIN
 PERFORM mwd_access_research.append_mock_review_audit(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SIM-HN-001',
 'bank-hn','mock-reviewer-z1','review_created_mock','bank_payout');
 RAISE EXCEPTION 'Replay adulterado aceptado';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 PERFORM mwd_access_research.append_mock_review_audit(
 '22222222-2222-4222-8222-222222222222',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SIM-HN-001',
 'bank-hn','mock-reviewer-a1','second_review_recorded_mock','bank_payout');
 RAISE EXCEPTION 'Autoaprobación aceptada';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 PERFORM mwd_access_research.append_mock_review_audit(
 '33333333-3333-4333-8333-333333333333',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SIM-NI-001',
 'bank-ni','mock-reviewer-b2','second_review_recorded_mock','bank_payout');
 RAISE EXCEPTION 'Cruce de país aceptado';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 y:=mwd_access_research.append_mock_review_audit(
 '44444444-4444-4444-8444-444444444444',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SIM-HN-001',
 'bank-hn','mock-reviewer-b2','second_review_recorded_mock','bank_payout');
 IF y->>'already_processed'<>'false' THEN RAISE EXCEPTION 'Doble revisión ficticia inválida';END IF;
 BEGIN
 PERFORM mwd_access_research.append_mock_review_audit(
 '55555555-5555-4555-8555-555555555555',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SIM-HN-001',
 'bank-hn','mock-reviewer-c3','review_expired_mock','bank_payout');
 RAISE EXCEPTION 'Permite cambiar revisión cerrada';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 SELECT count(*) INTO n FROM mwd_access_research.mock_review_audit_entries;
 IF n<>2 THEN RAISE EXCEPTION 'Historial incorrecto';END IF;
 y:=mwd_access_research.verify_mock_review_audit();
 IF y->>'integrity_ok_mock'<>'true' OR (y->>'events_checked')::bigint<>2
 THEN RAISE EXCEPTION 'Cadena hash inválida';END IF;
 BEGIN
 UPDATE mwd_access_research.mock_review_audit_entries SET state='pending_mock' WHERE seq=2;
 RAISE EXCEPTION 'Permitió alterar bitácora';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
-- La prueba crea una discrepancia de cabecera dentro de una subtransacción
-- y verifica que la detección funcione ANTES de deshacerla.
DO $$
DECLARE result jsonb;
BEGIN
 UPDATE mwd_access_research.mock_review_audit_head SET last_hash=repeat('f',64)
 WHERE singleton=true;
 result:=mwd_access_research.verify_mock_review_audit();
 IF result->>'integrity_ok_mock'<>'false' THEN
 RAISE EXCEPTION 'No se detectó una discrepancia forzada';END IF;
 -- Revertimos al hash correcto dentro de la transacción de CI únicamente.
 UPDATE mwd_access_research.mock_review_audit_head h
 SET last_hash=(SELECT entry_hash FROM mwd_access_research.mock_review_audit_entries ORDER BY seq DESC LIMIT 1)
 WHERE singleton=true;
END $$;
DO $$
BEGIN
 IF has_table_privilege('authenticated','mwd_access_research.mock_review_audit_entries','SELECT')
 OR has_function_privilege('authenticated','mwd_access_research.append_mock_review_audit(uuid,uuid,text,text,text,text,text)','EXECUTE')
 OR has_function_privilege('mwd_lab_staff_bank_hn','mwd_access_research.append_mock_review_audit(uuid,uuid,text,text,text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Auditoría expuesta a cliente o empleado';END IF;
END $$;
SELECT 'Bitácora persistente ficticia: idempotencia, auditoría y aislamiento OK' AS result;
