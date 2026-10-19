\set ON_ERROR_STOP on
-- Base de datos CI totalmente desechable; nunca modificar Supabase real.
create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
grant execute on function auth.uid() to authenticated;
create table public.mwd_wallets(
 user_id uuid primary key, account_code text not null unique,
 balance_cents bigint not null check(balance_cents>=0));
create table public.mwd_operations(
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null,request_id uuid not null,kind text not null,
 source_user_id uuid not null,destination_user_id uuid,
 amount_cents bigint not null,created_at timestamptz not null default now(),
 unique(actor_id,request_id));
insert into public.mwd_wallets values
 ('11111111-1111-4111-8111-111111111111','MWD-AAAAAAAAAAAAAAAA',100000),
 ('22222222-2222-4222-8222-222222222222','MWD-BBBBBBBBBBBBBBBB',200000);
\ir fixtures/mwd-core-rpcs-snapshot-demo.sql
\ir ../database/mwd_operation_status_demo.sql
