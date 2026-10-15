# Arquitectura mundial de socios y agentes pagadores — Moneda Mundial 2.0
# PROPUESTA DE BASE DE DATOS. NO EJECUTAR EN SUPABASE DEL DEMO.
# NO SON AGENTES EXISTENTES: todas las entidades se crearían como BORRADOR.
# El esquema es privado, no expuesto como API del móvil.
CREATE SCHEMA IF NOT EXISTS mwd_payout_private;

CREATE TABLE mwd_payout_private.partners (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 legal_name text NOT NULL,
 partner_type text NOT NULL CHECK (partner_type IN ('bank','remittance_operator','cash_agent_network')),
 country_code char(2) NOT NULL,
 due_diligence_status text NOT NULL DEFAULT 'draft'
   CHECK (due_diligence_status IN ('draft','review','verified','rejected','suspended')),
 contract_status text NOT NULL DEFAULT 'draft'
   CHECK (contract_status IN ('draft','review','signed','expired','terminated')),
 payout_operational_status text NOT NULL DEFAULT 'disabled'
   CHECK (payout_operational_status IN ('disabled','testing','suspended')),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mwd_payout_private.partner_authorizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 partner_id uuid NOT NULL REFERENCES mwd_payout_private.partners(id),
 jurisdiction_country char(2) NOT NULL,
 jurisdiction_region text,
 permission_type text NOT NULL,
 regulator_name text,
 authorization_reference text,
 verification_status text NOT NULL DEFAULT 'pending'
   CHECK (verification_status IN ('pending','verified','expired','revoked')),
 verified_at timestamptz,
 expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (verification_status <> 'verified' OR verified_at IS NOT NULL)
);

CREATE TABLE mwd_payout_private.payout_branches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 partner_id uuid NOT NULL REFERENCES mwd_payout_private.partners(id),
 country_code char(2) NOT NULL,
 region text,
 city text,
 address text,
 local_timezone text,
 hours_json jsonb NOT NULL DEFAULT '{}'::jsonb,
 verified_status text NOT NULL DEFAULT 'draft'
   CHECK (verified_status IN ('draft','review','verified','suspended','revoked')),
 operational_status text NOT NULL DEFAULT 'disabled'
   CHECK (operational_status IN ('disabled','testing','suspended')),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mwd_payout_private.payout_branch_currencies (
 branch_id uuid NOT NULL REFERENCES mwd_payout_private.payout_branches(id),
 currency_code char(3) NOT NULL,
 PRIMARY KEY (branch_id,currency_code)
);

CREATE TABLE mwd_payout_private.payout_corridors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 origin_country char(2) NOT NULL,
 destination_country char(2) NOT NULL,
 payout_currency char(3) NOT NULL,
 partner_id uuid NOT NULL REFERENCES mwd_payout_private.partners(id),
 corridor_status text NOT NULL DEFAULT 'draft'
   CHECK (corridor_status IN ('draft','review','tested','suspended')),
 compliance_status text NOT NULL DEFAULT 'not_verified',
 settlement_status text NOT NULL DEFAULT 'not_verified',
 per_transaction_limit_cents bigint,
 fx_quote_provider text,
 fee_provider text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(origin_country,destination_country,payout_currency,partner_id)
);

CREATE TABLE mwd_payout_private.partner_audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 entity_type text NOT NULL,
 entity_id uuid NOT NULL,
 event_type text NOT NULL,
 actor_id uuid,
 event_time timestamptz NOT NULL DEFAULT now(),
 details jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Barrera doble. Sin permisos directos de usuarios; RLS sin políticas.
ALTER TABLE mwd_payout_private.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_payout_private.partner_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_payout_private.payout_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_payout_private.payout_branch_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_payout_private.payout_corridors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwd_payout_private.partner_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA mwd_payout_private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA mwd_payout_private FROM PUBLIC;
-- Solo se configurarán roles de backend una vez haya socios, contratos y revisión.
-- NO CREAR EN ESTA PROPUESTA RUTAS NI FUNCIONES DE EMISIÓN / COBRO REAL.
