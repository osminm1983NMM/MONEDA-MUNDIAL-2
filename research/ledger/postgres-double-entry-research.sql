-- MONEDA MUNDIAL 2.0: INVESTIGACION DE LIBRO MAYOR DE PARTIDA DOBLE.
-- SOLO para PostgreSQL DESECHABLE de CI. NO desplegar en Supabase ni usar en producción.
-- Sin fondos, usuarios, cuentas bancarias, API de pago, proveedor o asientos verdaderos.
CREATE SCHEMA IF NOT EXISTS mwd_ledger_research;
REVOKE ALL ON SCHEMA mwd_ledger_research FROM PUBLIC, anon, authenticated;

CREATE TABLE mwd_ledger_research.accounts(
  code text PRIMARY KEY CHECK (code ~ '^[A-Z][A-Z0-9_]{4,64}$'),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  category text NOT NULL CHECK (category IN ('asset','liability','revenue','expense'))
);

CREATE TABLE mwd_ledger_research.journals(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_key uuid NOT NULL UNIQUE,
  external_reference text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'funding_mock_confirmed','payout_mock_reserved',
    'payout_mock_confirmed','reversal_mock'
  )),
  request_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE mwd_ledger_research.journal_lines(
  journal_id bigint NOT NULL REFERENCES mwd_ledger_research.journals(id) ON DELETE RESTRICT,
  line_no smallint NOT NULL CHECK (line_no BETWEEN 1 AND 12),
  account_code text NOT NULL REFERENCES mwd_ledger_research.accounts(code) ON DELETE RESTRICT,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  side text NOT NULL CHECK (side IN ('debit','credit')),
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 999999999999),
  PRIMARY KEY (journal_id,line_no),
  UNIQUE (journal_id,account_code)
);

-- Informes inventados, sin conciliación contra ninguna institución.
CREATE TABLE mwd_ledger_research.mock_statements(
  report_id uuid PRIMARY KEY,
  account_code text NOT NULL REFERENCES mwd_ledger_research.accounts(code),
  observed_minor bigint NOT NULL CHECK (observed_minor>=0),
  ledger_minor bigint NOT NULL,
  variance_minor bigint NOT NULL,
  cutoff_journal_id bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('matched','discrepancy')),
  source_verified boolean NOT NULL DEFAULT false CHECK (source_verified=false),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION mwd_ledger_research.reject_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'Libro mayor de investigación: no se permite modificar o eliminar asientos'
  USING ERRCODE='42501';
END $$;
CREATE TRIGGER research_journals_append_only
 BEFORE UPDATE OR DELETE ON mwd_ledger_research.journals
 FOR EACH ROW EXECUTE FUNCTION mwd_ledger_research.reject_changes();
CREATE TRIGGER research_lines_append_only
 BEFORE UPDATE OR DELETE ON mwd_ledger_research.journal_lines
 FOR EACH ROW EXECUTE FUNCTION mwd_ledger_research.reject_changes();
CREATE TRIGGER research_reports_append_only
 BEFORE UPDATE OR DELETE ON mwd_ledger_research.mock_statements
 FOR EACH ROW EXECUTE FUNCTION mwd_ledger_research.reject_changes();

-- Un INSERT de diario y de sus líneas comparte la misma transacción.
-- Ante cualquier error (cuenta, moneda o falta de equilibrio), TODO se revierte.
-- Sólo el propietario del esquema en CI puede ejecutarlo, NUNCA la app móvil.
CREATE OR REPLACE FUNCTION mwd_ledger_research.post_mock_journal(
  p_key uuid,p_reference text,p_event_type text,p_lines jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 v_payload jsonb;
 v_existing jsonb;
 v_id bigint;
 v_line jsonb;
 v_line_no bigint;
 v_account text;
 v_currency text;
 v_side text;
 v_amount bigint;
 v_seen text[] := ARRAY[]::text[];
 v_debit numeric;
 v_credit numeric;
BEGIN
 IF p_key IS NULL OR p_reference IS NULL
    OR p_reference !~ '^[A-Za-z0-9_-]{6,80}$'
    OR p_event_type IS NULL OR p_event_type NOT IN (
      'funding_mock_confirmed','payout_mock_reserved',
      'payout_mock_confirmed','reversal_mock')
    OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_lines) NOT BETWEEN 2 AND 12 THEN
   RAISE EXCEPTION 'Datos de asiento DEMO inválidos' USING ERRCODE='22023';
 END IF;
 v_payload:=jsonb_build_object('event',p_event_type,'reference',p_reference,'lines',p_lines);
 INSERT INTO mwd_ledger_research.journals(request_key,external_reference,event_type,request_payload)
 VALUES(p_key,p_reference,p_event_type,v_payload)
 ON CONFLICT(request_key) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN
   SELECT id,request_payload INTO v_id,v_existing
   FROM mwd_ledger_research.journals WHERE request_key=p_key;
   IF NOT FOUND THEN RAISE EXCEPTION 'Reintento inconsistente' USING ERRCODE='40001'; END IF;
   IF v_existing <> v_payload THEN
     RAISE EXCEPTION 'Clave idempotente reutilizada con otros datos' USING ERRCODE='22023';
   END IF;
   RETURN jsonb_build_object('journal_id',v_id,'already_processed',true,
     'balanced',true,'mock_only',true,'real_money_enabled',false);
 END IF;

 FOR v_line,v_line_no IN SELECT value,ordinality FROM jsonb_array_elements(p_lines)
   WITH ORDINALITY LOOP
   IF jsonb_typeof(v_line) IS DISTINCT FROM 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(v_line)) <> 3
     OR NOT (v_line ? 'account' AND v_line ? 'side' AND v_line ? 'amount_minor')
   THEN RAISE EXCEPTION 'Línea de asiento inválida' USING ERRCODE='22023'; END IF;
   v_account:=v_line->>'account';
   v_side:=v_line->>'side';
   IF v_account IS NULL OR v_account = ANY(v_seen)
      OR v_side IS NULL OR v_side NOT IN('debit','credit')
      OR jsonb_typeof(v_line->'amount_minor') IS DISTINCT FROM 'string'
      OR (v_line->>'amount_minor') !~ '^[1-9][0-9]{0,11}$' THEN
     RAISE EXCEPTION 'Cuenta duplicada, lado o importe inválido'
        USING ERRCODE='22023';
   END IF;
   v_amount:=(v_line->>'amount_minor')::bigint;
   IF v_amount>999999999999 THEN
      RAISE EXCEPTION 'Importe excede límite DEMO' USING ERRCODE='22023';
   END IF;
   SELECT currency INTO v_currency FROM mwd_ledger_research.accounts
     WHERE code=v_account;
   IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta de investigación inexistente' USING ERRCODE='22023'; END IF;
   INSERT INTO mwd_ledger_research.journal_lines
     (journal_id,line_no,account_code,currency,side,amount_minor)
   VALUES(v_id,v_line_no::smallint,v_account,v_currency,v_side,v_amount);
   v_seen:=array_append(v_seen,v_account);
 END LOOP;

 -- Debe cuadrar DEBE = HABER EN CADA DIVISA.
 -- No permite justificar un déficit de USD con unidades HNL o Coin.
 FOR v_currency,v_debit,v_credit IN
   SELECT currency,
     coalesce(sum(amount_minor) FILTER(WHERE side='debit'),0),
     coalesce(sum(amount_minor) FILTER(WHERE side='credit'),0)
   FROM mwd_ledger_research.journal_lines WHERE journal_id=v_id
   GROUP BY currency
 LOOP
   IF v_debit<>v_credit THEN
     RAISE EXCEPTION 'Asiento no balanceado en %',v_currency USING ERRCODE='22023';
   END IF;
 END LOOP;
 RETURN jsonb_build_object('journal_id',v_id,'already_processed',false,
   'balanced',true,'mock_only',true,'real_money_enabled',false);
END $$;

CREATE OR REPLACE FUNCTION mwd_ledger_research.reconcile_mock_statement(
 p_report_id uuid,p_account_code text,p_observed_minor bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_row mwd_ledger_research.mock_statements%rowtype;
 v_book bigint;v_variance bigint;v_last bigint;v_category text;v_status text;
BEGIN
 IF p_report_id IS NULL OR p_account_code IS NULL OR
    p_observed_minor IS NULL OR p_observed_minor<0 THEN
   RAISE EXCEPTION 'Informe DEMO inválido' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_row FROM mwd_ledger_research.mock_statements WHERE report_id=p_report_id;
 IF FOUND THEN
   IF v_row.account_code<>p_account_code OR v_row.observed_minor<>p_observed_minor THEN
     RAISE EXCEPTION 'Reporte idempotente reutilizado con otros datos' USING ERRCODE='22023';
   END IF;
   RETURN jsonb_build_object('status',v_row.status,'variance_minor',v_row.variance_minor,
     'ledger_minor',v_row.ledger_minor,'cutoff_journal_id',v_row.cutoff_journal_id,
     'already_processed',true,'source_verified',false,'real_money_enabled',false);
 END IF;
 SELECT category INTO v_category FROM mwd_ledger_research.accounts
 WHERE code=p_account_code;
 IF NOT FOUND OR v_category<>'asset' OR p_account_code NOT LIKE 'BANK_CLEARING_%'
 THEN RAISE EXCEPTION 'Sólo puede conciliar cuenta asset bancaria ficticia' USING ERRCODE='22023'; END IF;

 SELECT coalesce(sum(CASE WHEN l.side='debit' THEN l.amount_minor ELSE -l.amount_minor END),0)::bigint,
        coalesce(max(j.id),0)
 INTO v_book,v_last
 FROM mwd_ledger_research.journal_lines l
 JOIN mwd_ledger_research.journals j ON j.id=l.journal_id
 WHERE l.account_code=p_account_code;
 v_variance:=p_observed_minor-v_book;
 v_status:=CASE WHEN v_variance=0 THEN 'matched' ELSE 'discrepancy' END;
 INSERT INTO mwd_ledger_research.mock_statements(
   report_id,account_code,observed_minor,ledger_minor,variance_minor,cutoff_journal_id,status
 ) VALUES(p_report_id,p_account_code,p_observed_minor,v_book,v_variance,v_last,v_status);
 RETURN jsonb_build_object('status',v_status,'variance_minor',v_variance,
   'ledger_minor',v_book,'cutoff_journal_id',v_last,
   'already_processed',false,'source_verified',false,'real_money_enabled',false);
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA mwd_ledger_research FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA mwd_ledger_research FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mwd_ledger_research FROM PUBLIC,anon,authenticated;
COMMENT ON SCHEMA mwd_ledger_research IS
'NO USAR EN PRODUCCION: prototipo aislado CI sin fondos, divisas, usuarios ni proveedores bancarios.';
