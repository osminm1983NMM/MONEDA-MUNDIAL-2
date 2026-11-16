-- Auditoría de lectura de Moneda Mundial DEMO.
-- No cambia datos, no ejecuta transferencias ni requiere credenciales de usuarios.
-- Ejecutar con una conexión administrativa de solo lectura.
SELECT
  (SELECT count(*) FROM public.mwd_wallets) AS wallet_count,
  (SELECT count(*) FROM public.mwd_operations) AS operation_count,
  (SELECT count(*) FROM public.mwd_wallets WHERE balance_cents < 0) AS negative_wallets,
  (SELECT count(*) FROM public.mwd_operations
     WHERE kind = 'transfer' AND
       (source_user_id IS NULL OR destination_user_id IS NULL
        OR source_user_id = destination_user_id)) AS malformed_transfers,
  (SELECT count(*) FROM (
     SELECT actor_id, request_id FROM public.mwd_operations
     GROUP BY actor_id, request_id HAVING count(*) > 1
   ) AS repeated) AS repeated_request_keys,
  (SELECT count(*) FROM public.mwd_operations o
     LEFT JOIN public.mwd_wallets s ON s.user_id = o.source_user_id
     WHERE s.user_id IS NULL) AS missing_source_wallets,
  (SELECT count(*) FROM public.mwd_operations o
     LEFT JOIN public.mwd_wallets d ON d.user_id = o.destination_user_id
     WHERE o.destination_user_id IS NOT NULL AND d.user_id IS NULL)
    AS missing_destination_wallets;

-- Este informe no demuestra conciliación histórica ni seguridad ante concurrencia.
-- No inferir que el sistema es apto para dinero real a partir de estos conteos.
