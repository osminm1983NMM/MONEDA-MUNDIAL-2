-- Moneda Mundial 2.0: prueba PostgreSQL aislada y reversible.
-- Ejecutar manualmente SOLO tras revisar. No usa tablas reales.
-- Todas las tablas son TEMP y toda la sesión de prueba termina en ROLLBACK.
BEGIN;
CREATE TEMP TABLE mwd_test_wallet (
  account text PRIMARY KEY,
  balance_cents bigint NOT NULL CHECK (balance_cents >= 0)
) ON COMMIT DROP;
CREATE TEMP TABLE mwd_test_tx (
  reference text PRIMARY KEY CHECK (btrim(reference) <> ''),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','posted'))
) ON COMMIT DROP;
CREATE TEMP TABLE mwd_test_entry (
  reference text NOT NULL REFERENCES mwd_test_tx(reference),
  account text NOT NULL REFERENCES mwd_test_wallet(account),
  side text NOT NULL CHECK (side IN ('debit','credit')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0)
) ON COMMIT DROP;

INSERT INTO mwd_test_wallet VALUES ('A',1000000),('B',1000000);
INSERT INTO mwd_test_tx(reference) VALUES ('TEST-MWD-001');
INSERT INTO mwd_test_entry VALUES
 ('TEST-MWD-001','A','debit',100),
 ('TEST-MWD-001','B','credit',100);

DO $test$
DECLARE debit_total bigint; credit_total bigint; n integer;
BEGIN
  SELECT count(*),
         coalesce(sum(amount_cents) FILTER (WHERE side='debit'),0),
         coalesce(sum(amount_cents) FILTER (WHERE side='credit'),0)
    INTO n,debit_total,credit_total
  FROM mwd_test_entry WHERE reference='TEST-MWD-001';
  IF n<>2 OR debit_total<>100 OR credit_total<>100 THEN
    RAISE EXCEPTION 'Fallo en equilibrio contable de prueba';
  END IF;
  UPDATE mwd_test_tx SET state='posted' WHERE reference='TEST-MWD-001';

  -- La unicidad de referencia debe rechazar el duplicado.
  BEGIN
    INSERT INTO mwd_test_tx(reference) VALUES ('TEST-MWD-001');
    RAISE EXCEPTION 'FALLO: referencia duplicada aceptada';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- La restricción debe rechazar importe cero.
  BEGIN
    INSERT INTO mwd_test_entry VALUES ('TEST-MWD-001','A','debit',0);
    RAISE EXCEPTION 'FALLO: importe cero aceptado';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- La restricción debe rechazar referencia vacía.
  BEGIN
    INSERT INTO mwd_test_tx(reference) VALUES ('   ');
    RAISE EXCEPTION 'FALLO: referencia vacía aceptada';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$test$;

SELECT reference, state FROM mwd_test_tx;
SELECT reference,
 sum(amount_cents) FILTER (WHERE side='debit') AS debitos,
 sum(amount_cents) FILTER (WHERE side='credit') AS creditos
FROM mwd_test_entry GROUP BY reference;
ROLLBACK;

-- Limitación: esto comprueba restricciones y equilibrio en tablas TEMP.
-- NO demuestra aún protección de asientos publicados, concurrencia,
-- ni integración con las funciones reales de Supabase.
