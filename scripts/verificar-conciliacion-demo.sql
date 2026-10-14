-- MONEDA MUNDIAL: conciliación de créditos ficticios
-- SOLO LECTURA. No crea, mueve ni devuelve dinero.
-- Ejecutar en el proyecto Supabase de demostración.
-- Cada usuario inicia con 1,000,000 centavos MWD (= 10,000.00).
WITH resumen AS (
  SELECT
    w.user_id,
    w.balance_cents AS saldo_registrado,
    1000000::bigint
      + COALESCE((SELECT SUM(o.amount_cents)
          FROM public.mwd_operations o
          WHERE o.kind = 'transfer' AND o.destination_user_id = w.user_id),0)
      - COALESCE((SELECT SUM(o.amount_cents)
          FROM public.mwd_operations o
          WHERE o.source_user_id = w.user_id),0)
      AS saldo_esperado
  FROM public.mwd_wallets w
)
SELECT COUNT(*) AS cuentas,
       COUNT(*) FILTER (WHERE saldo_esperado != saldo_registrado) AS cuentas_descuadradas,
       SUM(saldo_registrado) AS total_registrado_centavos,
       SUM(saldo_esperado) AS total_esperado_centavos
FROM resumen;

-- Debe devolver 0 duplicados. Hay restricción UNIQUE(actor_id, request_id).
SELECT COUNT(*) AS grupos_duplicados
FROM (
  SELECT actor_id, request_id
  FROM public.mwd_operations
  GROUP BY actor_id, request_id
  HAVING COUNT(*) > 1
) d;

-- Actividad agregada sin correos ni identificadores de usuario.
SELECT kind, COUNT(*) AS cantidad, COALESCE(SUM(amount_cents),0) AS centavos_ficticios
FROM public.mwd_operations GROUP BY kind ORDER BY kind;

-- Comprobaciones cualitativas: nunca tomar este SQL como aprobación de producción.
-- Quedan pendientes pruebas con dos sesiones Auth REALES, pago de comercios,
-- concurrencia y ensayos de desconexión, seguridad y reembolsos.
