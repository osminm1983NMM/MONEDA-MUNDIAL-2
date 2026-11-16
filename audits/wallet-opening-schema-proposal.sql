-- PROPUESTA DE MIGRACION. NO EJECUTAR EN LA BASE PRINCIPAL.
-- Solo para revisión y pruebas en una base PostgreSQL aislada.
-- Los saldos son MWD FICTICIOS; no habilita dinero real.
BEGIN;

-- El esquema no existe actualmente en la base demo auditada.
CREATE SCHEMA IF NOT EXISTS mwd_finance_private;
REVOKE ALL ON SCHEMA mwd_finance_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS mwd_finance_private.wallet_opening_entries (
  wallet_user_id uuid PRIMARY KEY REFERENCES public.mwd_wallets(user_id) ON DELETE RESTRICT,
  opening_amount_cents bigint NOT NULL CHECK (opening_amount_cents >= 0),
  currency_code text NOT NULL DEFAULT 'MWD' CHECK (currency_code = 'MWD'),
  source_kind text NOT NULL CHECK (source_kind IN ('new_wallet', 'legacy_reconstruction')),
  source_reference text NOT NULL CHECK (length(btrim(source_reference)) BETWEEN 1 AND 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE mwd_finance_private.wallet_opening_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mwd_finance_private.wallet_opening_entries FROM PUBLIC, anon, authenticated;

-- Defensa en profundidad: UPDATE/DELETE rechazados incluso si un rol
-- privilegiado tiene permisos DML. Propietarios/superusuarios pueden
-- alterar triggers: se requieren controles operativos externos.
CREATE OR REPLACE FUNCTION mwd_finance_private.reject_opening_entry_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Los asientos de apertura son inmutables' USING ERRCODE='42501';
END;
$$;
REVOKE ALL ON FUNCTION mwd_finance_private.reject_opening_entry_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS opening_entry_no_update_delete ON mwd_finance_private.wallet_opening_entries;
CREATE TRIGGER opening_entry_no_update_delete
BEFORE UPDATE OR DELETE ON mwd_finance_private.wallet_opening_entries
FOR EACH ROW EXECUTE FUNCTION mwd_finance_private.reject_opening_entry_mutation();

-- Pendiente: integrar inserción del asiento en mwd_handle_new_user
-- en la misma transacción, con revisión de privilegios y pruebas reales.
-- No incluir reconstrucción histórica automática ni GRANT de escritura.
COMMIT;
