-- PREFLIGHT SOLO LECTURA: no crea usuarios ni cambia saldos.
-- Ejecutar antes de considerar cualquier migracion de apertura contable.
SELECT p.proname, pg_get_userbyid(p.proowner) AS function_owner,
 p.prosecdef AS security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='mwd_handle_new_user';

SELECT t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='auth' AND c.relname='users' AND t.tgname='mwd_new_auth_user';

SELECT EXISTS(SELECT 1 FROM information_schema.schemata
 WHERE schema_name='mwd_finance_private') AS private_schema_exists;

SELECT count(*) AS wallets,
 count(*) FILTER (WHERE balance_cents<0) AS negative_wallets
FROM public.mwd_wallets;

-- IMPORTANTE: esta comprobacion NO valida transacciones reales,
-- permisos de un esquema aun no desplegado ni registro de nuevos usuarios.
