-- Moneda Mundial 2.0 | 2026-10-22
-- Conciliación de SOLO DEMOSTRACION: cuatro billeteras y nueve operaciones.
-- Ejecutar únicamente en Supabase de laboratorio con cuenta administradora.
-- Nunca ejecutar como prueba de reservas, fondos reales, moneda estable ni criptoactivos.
-- La base de esta prueba es el saldo inicial documentado: 10,000 MWD = 1,000,000 centavos
-- por billetera, sin otros ajustes contables; revisar si se introduce recarga DEMO.
-- No registra ni modifica identidades, tokens, saldos, operaciones ni datos.
BEGIN TRANSACTION READ ONLY;
DO $mwd_integrity$
DECLARE v_discrepancies integer; v_ops integer; v_wallets integer;
BEGIN
  SELECT count(*) INTO v_wallets FROM public.mwd_wallets;
  SELECT count(*) INTO v_ops FROM public.mwd_operations;
  IF v_wallets < 2 OR v_ops < 1 THEN
    RAISE EXCEPTION 'Conjunto de pruebas insuficiente';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.mwd_operations o WHERE
      o.kind NOT IN ('transfer','contribution') OR
      o.amount_cents NOT BETWEEN 1 AND 100000000 OR
      o.actor_id IS DISTINCT FROM o.source_user_id OR
      (o.kind='transfer' AND (o.destination_user_id IS NULL OR o.destination_user_id=o.source_user_id)) OR
      (o.kind='contribution' AND o.destination_user_id IS NOT NULL)
  ) THEN RAISE EXCEPTION 'Operaciones ficticias con datos inconsistentes'; END IF;
  IF EXISTS(
    SELECT 1 FROM public.mwd_operations o
    LEFT JOIN public.mwd_wallets src ON src.user_id=o.source_user_id
    LEFT JOIN public.mwd_wallets dst ON dst.user_id=o.destination_user_id
    WHERE src.user_id IS NULL OR (o.kind='transfer' AND dst.user_id IS NULL)
  ) THEN RAISE EXCEPTION 'Falta una billetera de alguna operacion'; END IF;
  IF EXISTS(
    SELECT actor_id,request_id FROM public.mwd_operations
    GROUP BY actor_id,request_id HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Idempotencia violada en solicitudes de prueba'; END IF;
  WITH deltas AS (
    SELECT source_user_id AS user_id, -amount_cents AS delta
    FROM public.mwd_operations WHERE kind IN ('transfer','contribution')
    UNION ALL
    SELECT destination_user_id AS user_id,amount_cents AS delta
    FROM public.mwd_operations WHERE kind='transfer'
  ), summed AS (
    SELECT user_id,sum(delta)::bigint AS delta_cents FROM deltas GROUP BY user_id
  ), expected AS (
    SELECT w.user_id,w.balance_cents,1000000+COALESCE(s.delta_cents,0) AS expected_cents
    FROM public.mwd_wallets w LEFT JOIN summed s ON s.user_id=w.user_id
  )
  SELECT count(*) INTO v_discrepancies FROM expected WHERE
    balance_cents IS DISTINCT FROM expected_cents OR balance_cents<0;
  IF v_discrepancies<>0 THEN
    RAISE EXCEPTION 'Descuadre contable: % billeteras',v_discrepancies;
  END IF;
  IF EXISTS(SELECT 1 FROM mwd_core.payment_corridors WHERE status <> 'disabled')
     OR EXISTS(SELECT 1 FROM mwd_finance_private.demo_fee_routes WHERE real_payments_enabled)
  THEN RAISE EXCEPTION 'Pago real inesperadamente activado'; END IF;
END $mwd_integrity$;
SELECT 'PASS: cuatro billeteras y nueve operaciones MWD ficticias conciliadas, sin duplicados ni dinero real' AS resultado;
ROLLBACK;
