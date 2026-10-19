-- Exclusivamente PostgreSQL DESCARTABLE del runner CI.
-- Construye SOLO datos ficticios. NO conecta a Supabase ni contiene credenciales.
\set ON_ERROR_STOP on

DO $roles$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $roles$;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE auth.users(
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $fn$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $fn$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

INSERT INTO auth.users(id, created_at) VALUES
('11111111-1111-4111-8111-111111111111', timestamptz '2026-10-01 00:00:00+00'),
('22222222-2222-4222-8222-222222222222', timestamptz '2026-10-02 00:00:00+00');

-- Son solo tablas señuelo para el chequeo de que NO existan rutas reales.
CREATE TABLE public.mwd_admin_roles(user_id uuid NOT NULL, role text NOT NULL);
CREATE SCHEMA mwd_finance_private;
CREATE TABLE mwd_finance_private.demo_fee_routes(real_payments_enabled boolean NOT NULL DEFAULT false);
CREATE SCHEMA mwd_core;
CREATE TABLE mwd_core.payment_corridors(status text NOT NULL);

-- Importar el verdadero motor de conversiones ficticias del repositorio.
\ir ../../database/mwd_coin_stable_conversion_demo.sql
\ir ../../database/mwd_conversion_reconcile_demo.sql

-- No crear ninguna ruta o corredor real: las tablas permanecen vacías.
