-- Entorno aislado PostgreSQL, sin conexión a Supabase real.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.mwd_admin_roles(user_id uuid PRIMARY KEY,role text NOT NULL);
INSERT INTO auth.users VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.mwd_admin_roles VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner');
CREATE SCHEMA mwd_finance_private;
CREATE TABLE mwd_finance_private.world_country_catalog(country_code text PRIMARY KEY);
INSERT INTO mwd_finance_private.world_country_catalog VALUES ('US'),('NI'),('CR');
REVOKE ALL ON SCHEMA mwd_finance_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_finance_private FROM PUBLIC,anon,authenticated;
