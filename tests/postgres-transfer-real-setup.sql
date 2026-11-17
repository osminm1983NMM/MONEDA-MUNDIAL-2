\set ON_ERROR_STOP on
-- Only for ephemeral PostgreSQL CI. No Supabase production writes.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
ALTER TABLE public.mwd_wallets ADD COLUMN account_code text UNIQUE DEFAULT ('MWD-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)));
CREATE TABLE public.mwd_operations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL, request_id uuid NOT NULL, kind text NOT NULL, source_user_id uuid NOT NULL, destination_user_id uuid, amount_cents bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor_id,request_id));
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000040'),('00000000-0000-0000-0000-000000000041'),('00000000-0000-0000-0000-000000000042');
UPDATE public.mwd_wallets SET account_code='MWD-TEST41' WHERE user_id='00000000-0000-0000-0000-000000000041';
UPDATE public.mwd_wallets SET account_code='MWD-TEST42' WHERE user_id='00000000-0000-0000-0000-000000000042';
