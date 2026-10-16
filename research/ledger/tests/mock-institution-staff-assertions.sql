-- CI: escenarios de personal bancario/agente INVENTADO. No Supabase.
SET ROLE mwd_lab_staff_bank_hn;
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM mwd_access_research.work_items;
 IF n<>2 THEN RAISE EXCEPTION 'Banco HN no aislado';END IF;
 BEGIN
  EXECUTE 'SELECT * FROM mwd_access_research.work_items';
  RAISE EXCEPTION 'Se expusieron columnas internas';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  UPDATE mwd_access_research.staff_memberships SET membership_state='revoked_mock';
  RAISE EXCEPTION 'Empleado pudo cambiar su membresía';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
INSERT INTO mwd_access_research.review_actions(action_id,case_id,action_code,note_code)
VALUES('aaaa1111-1111-4111-8111-111111111111','SIM-HN-001','request_manual_review_mock','duplicate_mock');
DO $$
BEGIN
 BEGIN
  INSERT INTO mwd_access_research.review_actions(action_id,case_id,action_code,note_code)
  VALUES('aaaa2222-2222-4222-8222-222222222222','SIM-NI-001','request_manual_review_mock','duplicate_mock');
  RAISE EXCEPTION 'Empleado bancario vio orden ajena';
 EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;END;
END $$;
RESET ROLE;

SET ROLE mwd_lab_staff_bank_ni_pending;
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM mwd_access_research.work_items;
 IF n<>0 THEN RAISE EXCEPTION 'Pendiente pudo acceder';END IF;
END $$;
RESET ROLE;

SET ROLE mwd_lab_staff_agent_ni;
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM mwd_access_research.work_items;
 IF n<>2 THEN RAISE EXCEPTION 'Agente NI no aislado';END IF;
 BEGIN
  EXECUTE 'SELECT amount_minor FROM mwd_access_research.work_items';
  RAISE EXCEPTION 'Agente accedió a importe';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;

-- Sólo rol DBA desechable de CI ejerce transición administrativa.
UPDATE mwd_access_research.staff_memberships SET membership_state='active_mock'
WHERE staff_role='mwd_lab_staff_bank_ni_pending';
SET ROLE mwd_lab_staff_bank_ni_pending;
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM mwd_access_research.work_items;
 IF n<>2 THEN RAISE EXCEPTION 'La activación falló';END IF;
END $$;
RESET ROLE;
UPDATE mwd_access_research.staff_memberships SET membership_state='revoked_mock'
WHERE staff_role='mwd_lab_staff_bank_ni_pending';
SET ROLE mwd_lab_staff_bank_ni_pending;
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM mwd_access_research.work_items;
 IF n<>0 THEN RAISE EXCEPTION 'Membresía revocada sigue mostrando registros';END IF;
END $$;
RESET ROLE;

DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM mwd_access_research.staff_membership_audit
 WHERE staff_role='mwd_lab_staff_bank_ni_pending';
 IF n<>3 THEN RAISE EXCEPTION 'No se registró activación/revocación';END IF;
 IF has_table_privilege('authenticated','mwd_access_research.staff_memberships','SELECT')
 THEN RAISE EXCEPTION 'Cliente normal obtuvo acceso';END IF;
END $$;
SELECT 'Membresías DEMO: activación, aislamiento y revocación OK' AS result;
