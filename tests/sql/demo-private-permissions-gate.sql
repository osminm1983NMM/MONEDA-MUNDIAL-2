-- DEMO: private schemas, relations and RPC permissions. No writes.
BEGIN TRANSACTION READ ONLY;
DO $gate$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname LIKE 'mwd%private' AND c.relkind IN ('r','p','v','m');
 IF n<38 THEN RAISE EXCEPTION 'Private relation coverage incomplete'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace s WHERE s.nspname LIKE 'mwd%private' AND (has_schema_privilege('anon',s.oid,'USAGE,CREATE') OR has_schema_privilege('authenticated',s.oid,'USAGE,CREATE'))) THEN RAISE EXCEPTION 'Private schema exposed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname LIKE 'mwd%private' AND c.relkind IN ('r','p','v','m') AND (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') OR has_any_column_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') OR (c.relkind IN ('r','p') AND NOT c.relrowsecurity))) THEN RAISE EXCEPTION 'Private relation exposed or missing RLS'; END IF;
 -- Invoker-only trigger routines cannot be directly called as ordinary SQL functions.
 -- The schema must remain inaccessible, as checked above.
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname LIKE 'mwd%private' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')) AND NOT (p.prorettype='pg_catalog.trigger'::regtype AND NOT p.prosecdef)) THEN RAISE EXCEPTION 'Private non-trigger or privileged function granted to client'; END IF;
END $gate$;
ROLLBACK;
