-- Ejercicios de sesión persistente en base CI, no autenticación real.
INSERT INTO mwd_access_research.mock_sessions
 (token_sha256,staff_role,institution_role,issued_at,expires_at)
VALUES
 (repeat('a',64),'mwd_lab_staff_bank_hn','mwd_lab_bank_hn',
  clock_timestamp()-interval '1 minute',clock_timestamp()+interval '10 minutes'),
 (repeat('b',64),'mwd_lab_staff_agent_ni','mwd_lab_agent_ni',
  clock_timestamp()-interval '1 minute',clock_timestamp()+interval '10 minutes'),
 (repeat('c',64),'mwd_lab_staff_bank_hn','mwd_lab_bank_hn',
  clock_timestamp()-interval '20 minutes',clock_timestamp()-interval '10 minutes'),
 (repeat('d',64),'mwd_lab_staff_bank_ni_pending','mwd_lab_bank_ni',
  clock_timestamp()-interval '1 minute',clock_timestamp()+interval '10 minutes');
DO $$
DECLARE x jsonb;
BEGIN
 x:=mwd_access_research.mock_session_authorize(repeat('a',64),'SIM-HN-001','read_mock_cases');
 IF x->>'allowed'<>'true' OR x->>'real_money_enabled'<>'false' THEN
  RAISE EXCEPTION 'Sesión ficticia banco HN no autorizada correctamente';END IF;
 x:=mwd_access_research.mock_session_authorize(repeat('a',64),'SIM-NI-001','read_mock_cases');
 IF x->>'allowed'<>'false' THEN RAISE EXCEPTION 'Acceso entre instituciones permitido'; END IF;
 x:=mwd_access_research.mock_session_authorize(repeat('b',64),'SIM-NI-002','request_mock_review');
 IF x->>'allowed'<>'true' THEN RAISE EXCEPTION 'Agente de prueba denegado';END IF;
 x:=mwd_access_research.mock_session_authorize(repeat('c',64),'SIM-HN-001','read_mock_cases');
 IF x->>'allowed'<>'false' THEN RAISE EXCEPTION 'Token caducado permitido';END IF;
 x:=mwd_access_research.mock_session_authorize(repeat('d',64),'SIM-NI-001','read_mock_cases');
 IF x->>'allowed'<>'false' THEN RAISE EXCEPTION 'Miembro revocado/pendiente permitido';END IF;
 x:=mwd_access_research.mock_session_authorize(repeat('z',64),'SIM-HN-001','read_mock_cases');
 IF x->>'allowed'<>'false' THEN RAISE EXCEPTION 'Digest de sesión inválido permitido';END IF;
END $$;
UPDATE mwd_access_research.mock_sessions SET revoked_at=clock_timestamp()
 WHERE token_sha256=repeat('a',64);
DO $$
DECLARE x jsonb;
BEGIN
 x:=mwd_access_research.mock_session_authorize(repeat('a',64),'SIM-HN-001','read_mock_cases');
 IF x->>'allowed'<>'false' THEN RAISE EXCEPTION 'Sesión revocada autorizó una consulta';END IF;
 BEGIN
  UPDATE mwd_access_research.mock_sessions SET revoked_at=NULL
  WHERE token_sha256=repeat('a',64);
  RAISE EXCEPTION 'Reactivación de sesión ficticia';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
DO $$
BEGIN
 IF has_table_privilege('authenticated','mwd_access_research.mock_sessions','SELECT')
 OR has_function_privilege('authenticated','mwd_access_research.mock_session_authorize(text,text,text)','EXECUTE')
 OR has_function_privilege('mwd_lab_staff_bank_hn','mwd_access_research.mock_session_authorize(text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Exposición a actores no privilegiados';END IF;
END $$;
SELECT 'Sesiones persistentes ficticias: aislamiento, caducidad, revocación y permisos OK' AS result;
