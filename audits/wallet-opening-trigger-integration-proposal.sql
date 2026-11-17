-- PROPUESTA NO DESPLEGADA. Ejecutar SOLO en PostgreSQL aislado tras revisar
-- privilegios, compatibilidad con Supabase Auth y estrategia de rollback.
-- REQUIERE que wallet-opening-schema-proposal.sql haya sido aplicado primero.
-- La función es SECURITY DEFINER porque el trigger de auth.users debe
-- insertar en tablas restringidas; nunca se debe exponer como RPC pública.
BEGIN;

CREATE OR REPLACE FUNCTION public.mwd_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_opening_cents bigint;
BEGIN
  INSERT INTO public.mwd_profiles(user_id, display_name)
  VALUES (NEW.id, 'Usuario MWD');

  INSERT INTO public.mwd_wallets(user_id)
  VALUES (NEW.id)
  RETURNING balance_cents INTO v_opening_cents;

  INSERT INTO mwd_finance_private.wallet_opening_entries
    (wallet_user_id, opening_amount_cents, currency_code,
     source_kind, source_reference)
  VALUES
    (NEW.id, v_opening_cents, 'MWD', 'new_wallet',
     'auth.users trigger: mwd_new_auth_user');

  RETURN NEW;
END;
$$;

-- Evitar que usuarios invoquen manualmente una función de trigger.
REVOKE ALL ON FUNCTION public.mwd_handle_new_user() FROM PUBLIC, anon, authenticated;

-- No se cambia el trigger existente mwd_new_auth_user en auth.users.
-- Las tres inserciones pertenecen a la misma transacción: si falla el
-- asiento, falla el alta completa y debe investigarse antes de habilitarlo.
COMMIT;

-- Antes de implementar: probar signup exitoso, rollback por error,
-- intentos duplicados, rol propietario y grants, y signup concurrente.
-- Considerar registrar emisión/contrapartida para los créditos DEMO.
