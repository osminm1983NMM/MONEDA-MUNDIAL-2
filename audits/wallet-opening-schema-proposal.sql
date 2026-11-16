-- PROPUESTA DE MIGRACION. NO EJECUTAR EN LA BASE PRINCIPAL.
-- Solo para revisión y pruebas en una base PostgreSQL aislada.
-- Los saldos son MWD FICTICIOS; no habilita dinero real.

BEGIN;

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

-- Defensa en profundidad contra cambios de asientos ya escritos.
-- La ruta autorizada de provisión deberá poder insertar exactamente una vez,
-- sin UPDATE/DELETE. Un propietario de tabla/superusuario puede modificar
-- datos; se necesitan auditoría externa y controles operativos adicionales.
CREATE OR REPLACE FUNCTION mwd_finance_private.reject_opening_entry_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Los asientos de apertura son inmutables' USING ERRCODE='42501';
END;
$$;

DROP TRIGGER IF EXISTS opening_entry_no_update_delete ON mwd_finance_private.wallet_opening_entries;
CREATE TRIGGER opening_entry_no_update_delete
BEFORE UPDATE OR DELETE ON mwd_finance_private.wallet_opening_entries
FOR EACH ROW EXECUTE FUNCTION mwd_finance_private.reject_opening_entry_mutation();

-- NO incluir backfill automático: la reconstrucción histórica requiere
-- evidencia, revisión de diferencias y aprobación de cambios.
-- NO incluir GRANT de escritura ni función SECURITY DEFINER sin auditoría.
COMMIT;
