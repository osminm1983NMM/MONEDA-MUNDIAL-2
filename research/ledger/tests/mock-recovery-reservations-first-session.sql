-- Primera conexión de PostgreSQL desechará su sesión al finalizar el archivo.
DO $$
DECLARE a jsonb;b jsonb;count_rows integer;
BEGIN
 a:=mwd_recovery_research.reserve_mock_request(
  'SIM-US-SEND001','checkpoint-hn-request-001',
  '00000000-0000-4000-8000-000000000001','SIM-HN-RECIP01','HN',10000);
 IF a->>'status' IS DISTINCT FROM 'pending_verification_mock' OR
    a->>'already_processed' IS DISTINCT FROM 'false' OR
    a->>'safe_to_submit_again' IS DISTINCT FROM 'false' OR
    a->>'real_money_enabled' IS DISTINCT FROM 'false'
 THEN RAISE EXCEPTION 'La primera reserva no quedó bloqueada'; END IF;
 b:=mwd_recovery_research.reserve_mock_request(
  'SIM-US-SEND001','checkpoint-hn-request-001',
  '00000000-0000-4000-8000-000000000001','SIM-HN-RECIP01','HN',10000);
 IF b->>'already_processed' IS DISTINCT FROM 'true'
 THEN RAISE EXCEPTION 'No detectó reserva idéntica';END IF;

 BEGIN
  PERFORM mwd_recovery_research.reserve_mock_request(
   'SIM-US-SEND001','checkpoint-hn-request-001',
   '00000000-0000-4000-8000-000000000001','SIM-HN-RECIP01','HN',15000);
  RAISE EXCEPTION 'Aceptó reutilizar referencia con otro monto';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM mwd_recovery_research.reserve_mock_request(
   'SIM-US-SEND001','checkpoint-hn-request-002',
   '00000000-0000-4000-8000-000000000002','SIM-HN-RECIP01','HN',10000);
  RAISE EXCEPTION 'Aceptó segundo envío pendiente de la misma cuenta';
 EXCEPTION WHEN unique_violation THEN NULL; END;

 -- Cuenta B, Nicaragua: su reserva es independiente, no desaparece HN.
 PERFORM mwd_recovery_research.reserve_mock_request(
  'SIM-US-SEND002','checkpoint-ni-request-001',
  '00000000-0000-4000-8000-000000000003','SIM-NI-RECIP01','NI',20000);
 SELECT count(*) INTO count_rows FROM mwd_recovery_research.requests;
 IF count_rows<>2 THEN RAISE EXCEPTION 'Número inconsistente de reservas ficticias';END IF;

 BEGIN
  UPDATE mwd_recovery_research.requests SET amount_minor=1
  WHERE actor_alias='SIM-US-SEND001';
  RAISE EXCEPTION 'Se permitió cambiar monto reservado';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  DELETE FROM mwd_recovery_research.requests WHERE actor_alias='SIM-US-SEND001';
  RAISE EXCEPTION 'Se permitió borrar solicitud pendiente';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;

 IF has_schema_privilege('anon','mwd_recovery_research','USAGE') OR
    has_schema_privilege('authenticated','mwd_recovery_research','USAGE') OR
    has_function_privilege('anon',
     'mwd_recovery_research.reserve_mock_request(text,text,uuid,text,text,bigint)',
     'EXECUTE') OR
    has_function_privilege('authenticated',
     'mwd_recovery_research.inspect_mock_request(text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Se expuso la función DEMO a cliente';END IF;
END $$;
SELECT 'Checkpoint DEMO reservado: cuenta A HN y cuenta B NI, sin dinero real' AS result;
