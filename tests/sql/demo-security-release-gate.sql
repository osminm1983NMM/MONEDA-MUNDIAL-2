-- Read-only structural security checks; not a substitute for authenticated functional tests.
BEGIN TRANSACTION READ ONLY;
DO $gate$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND (n.nspname='public' OR n.nspname LIKE 'mwd%') AND has_function_privilege('anon',p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'Anonymous privileged execution'; END IF;
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname LIKE 'mwd%private' AND has_function_privilege('authenticated',p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'Private privileged execution'; END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('mwd_wallets','mwd_operations','mwd_admin_roles') AND c.relrowsecurity) <> 3 THEN RAISE EXCEPTION 'Missing RLS'; END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename IN ('mwd_wallets','mwd_operations','mwd_admin_roles') AND cmd <> 'SELECT') THEN RAISE EXCEPTION 'Unexpected write policy'; END IF;
 -- Privileged public MWD functions must pin an empty search_path.
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'mwd_%' AND p.prosecdef
 AND NOT coalesce(p.proconfig @> ARRAY['search_path=""'],false)) THEN
 RAISE EXCEPTION 'Unpinned search_path on privileged MWD RPC'; END IF;
 -- Prevent direct client mutation of the monetary and administrative core.
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('mwd_wallets','mwd_operations','mwd_admin_roles')
 AND (has_table_privilege('authenticated',c.oid,'INSERT') OR has_table_privilege('authenticated',c.oid,'UPDATE')
 OR has_table_privilege('authenticated',c.oid,'DELETE') OR has_table_privilege('authenticated',c.oid,'TRUNCATE')
 OR has_any_column_privilege('authenticated',c.oid,'INSERT') OR has_any_column_privilege('authenticated',c.oid,'UPDATE'))) THEN
 RAISE EXCEPTION 'Direct client write privilege on protected core'; END IF;
 -- Require non-partial, immediate, valid unique indexes for all idempotency keys.
 IF EXISTS (
   SELECT 1 FROM (VALUES
     ('public.mwd_operations'::regclass,ARRAY['actor_id','request_id']::text[]),
     ('public.mwd_wallets'::regclass,ARRAY['account_code']::text[]),
     ('mwd_swap_private.demo_quotes'::regclass,ARRAY['user_id','client_request_id']::text[]),
     ('mwd_swap_private.demo_conversions'::regclass,ARRAY['quote_id']::text[]),
     ('mwd_swap_private.demo_balances'::regclass,ARRAY['user_id','asset_code']::text[]),
     ('mwd_pickup_private.demo_orders'::regclass,ARRAY['sender_user_id','client_request_id']::text[]),
     ('mwd_pickup_private.demo_orders'::regclass,ARRAY['pickup_code_sha256']::text[])
   ) AS expected(rel,cols)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_index i
     WHERE i.indrelid=expected.rel AND i.indisunique AND i.indisvalid AND i.indisready AND i.indimmediate AND i.indpred IS NULL AND i.indexprs IS NULL
     AND (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(i.indkey) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum WHERE k.ord<=i.indnkeyatts)=expected.cols
   ) OR EXISTS (
     SELECT 1 FROM unnest(expected.cols) col
     WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=expected.rel AND a.attname=col AND a.attnotnull AND NOT a.attisdropped)
   )
 ) THEN RAISE EXCEPTION 'Missing required uniqueness or non-null key'; END IF;
END $gate$;
ROLLBACK;
