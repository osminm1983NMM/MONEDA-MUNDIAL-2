-- MONEDA MUNDIAL 2.0: laboratorio AISLADO de concurrencia.
-- NO ejecutar en producción; no toca tablas existentes, usuarios ni saldos reales.
-- El esquema demo tiene su propia remesa y un registro único de pagos.
BEGIN;
CREATE SCHEMA IF NOT EXISTS mwd_concurrency_lab;
REVOKE ALL ON SCHEMA mwd_concurrency_lab FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS mwd_concurrency_lab.remittances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_at timestamptz
);
CREATE TABLE IF NOT EXISTS mwd_concurrency_lab.payouts (
  remittance_id uuid PRIMARY KEY REFERENCES mwd_concurrency_lab.remittances(id),
  request_key text NOT NULL UNIQUE CHECK (length(request_key) BETWEEN 1 AND 128),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_concurrency_lab FROM PUBLIC, anon, authenticated;
ALTER TABLE mwd_concurrency_lab.remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_concurrency_lab.payouts ENABLE ROW LEVEL SECURITY;
-- UPDATE con condición y bloqueo de fila de PostgreSQL: solo uno cambia pending -> paid.
-- Si la inserción falla, la transacción completa revierte el cambio de estado.
CREATE OR REPLACE FUNCTION mwd_concurrency_lab.pay_once(p_id uuid, p_key text)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_amount bigint;
BEGIN
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid idempotency key' USING ERRCODE='22023';
  END IF;
  UPDATE mwd_concurrency_lab.remittances
     SET status='paid', paid_at=now()
   WHERE id=p_id AND status='pending'
   RETURNING amount_cents INTO v_amount;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO mwd_concurrency_lab.payouts(remittance_id,request_key,amount_cents)
    VALUES(p_id,p_key,v_amount);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION mwd_concurrency_lab.pay_once(uuid,text) FROM PUBLIC, anon, authenticated;
COMMIT;

-- Prueba de integración pendiente: en DOS sesiones distintas, iniciar
-- transacciones simultáneas y llamar pay_once con el MISMO id de remesa.
-- Confirmar exactamente un true, un false y una fila en payouts.
-- No confundir esta definición SQL con una prueba ejecutada.
