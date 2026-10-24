-- Nueva conexión Postgres después de que la primera dejó de existir.
DO $$
DECLARE a jsonb;b jsonb;done jsonb;count_rows integer;
BEGIN
 a:=mwd_recovery_research.inspect_mock_request(
  'SIM-US-SEND001','checkpoint-hn-request-001');
 b:=mwd_recovery_research.inspect_mock_request(
  'SIM-US-SEND002','checkpoint-ni-request-001');
 IF a->>'status' IS DISTINCT FROM 'pending_verification_mock' OR
    b->>'status' IS DISTINCT FROM 'pending_verification_mock' OR
    a->>'safe_to_submit_again' IS DISTINCT FROM 'false' OR
    b->>'safe_to_submit_again' IS DISTINCT FROM 'false'
 THEN RAISE EXCEPTION 'Perdió los pendientes al cerrar la primera sesión';END IF;

 done:=mwd_recovery_research.verify_mock_receipt(
  'SIM-US-SEND001','checkpoint-hn-request-001',
  '00000000-0000-4000-8000-000000000101');
 IF done->>'status' IS DISTINCT FROM 'verified_mock' OR
    done->>'already_processed' IS DISTINCT FROM 'false'
 THEN RAISE EXCEPTION 'No marcó recibo ficticio';END IF;
 done:=mwd_recovery_research.verify_mock_receipt(
  'SIM-US-SEND001','checkpoint-hn-request-001',
  '00000000-0000-4000-8000-000000000101');
 IF done->>'already_processed' IS DISTINCT FROM 'true'
 THEN RAISE EXCEPTION 'No detectó recibo duplicado';END IF;
 BEGIN
  PERFORM mwd_recovery_research.verify_mock_receipt(
   'SIM-US-SEND001','checkpoint-hn-request-001',
   '00000000-0000-4000-8000-000000000102');
  RAISE EXCEPTION 'Aceptó segundo recibo para una orden';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;END;

 -- Después de resolver A, otra solicitud suya vuelve a quedar pendiente.
 done:=mwd_recovery_research.reserve_mock_request(
  'SIM-US-SEND001','checkpoint-hn-request-002',
  '00000000-0000-4000-8000-000000000002','SIM-HN-RECIP01','HN',10000);
 IF done->>'status' IS DISTINCT FROM 'pending_verification_mock' OR
    done->>'already_processed' IS DISTINCT FROM 'false'
 THEN RAISE EXCEPTION 'No dejó abrir siguiente solicitud ficticia';END IF;
 -- B no se alteró al completar A.
 b:=mwd_recovery_research.inspect_mock_request(
  'SIM-US-SEND002','checkpoint-ni-request-001');
 IF b->>'status' IS DISTINCT FROM 'pending_verification_mock'
 THEN RAISE EXCEPTION 'Las cuentas se contaminaron';END IF;
 SELECT count(*) INTO count_rows FROM mwd_recovery_research.requests;
 IF count_rows<>3 THEN RAISE EXCEPTION 'Número inesperado de reservas: %',count_rows;END IF;
 IF (SELECT count(*) FROM mwd_recovery_research.requests WHERE status='verified_mock')<>1
 THEN RAISE EXCEPTION 'Confirmaciones ficticias duplicadas';END IF;
END $$;
SELECT 'Nueva sesión CI: reserva recuperada, recibo idempotente y dos cuentas aisladas' AS result;
