-- Base de datos PostgreSQL desechable, AISLADA de Supabase.
-- Esquema mínimo para validar sintaxis y acceso de clientes al activar RLS.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA mwd_core AUTHORIZATION CURRENT_USER;
REVOKE ALL ON SCHEMA mwd_core FROM PUBLIC, anon, authenticated;

CREATE TABLE mwd_core.currencies(currency_code text PRIMARY KEY);
CREATE TABLE mwd_core.countries(country_code text PRIMARY KEY);
CREATE TABLE mwd_core.country_currencies(
  country_code text NOT NULL REFERENCES mwd_core.countries(country_code),
  currency_code text NOT NULL REFERENCES mwd_core.currencies(currency_code),
  PRIMARY KEY(country_code,currency_code)
);
CREATE TABLE mwd_core.payment_corridors(
  id integer PRIMARY KEY,
  source_country text NOT NULL REFERENCES mwd_core.countries(country_code),
  destination_country text NOT NULL REFERENCES mwd_core.countries(country_code),
  status text NOT NULL DEFAULT 'disabled'
);
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_core FROM PUBLIC, anon, authenticated;

INSERT INTO mwd_core.currencies VALUES ('USD'),('CRC');
INSERT INTO mwd_core.countries VALUES ('US'),('CR');
INSERT INTO mwd_core.country_currencies VALUES ('US','USD'),('CR','CRC');
INSERT INTO mwd_core.payment_corridors VALUES (1,'US','CR','disabled');

-- Antes de la migración: simula las cuatro tablas internas sin RLS.
DO $$
BEGIN
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='mwd_core' AND c.relkind='r' AND c.relrowsecurity=false) <> 4
 THEN RAISE EXCEPTION 'La muestra de tablas no está en estado pre-RLS'; END IF;
END $$;
