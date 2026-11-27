#!/usr/bin/env node
'use strict';
// Emit SQL only. Never open a network connection. The generated SQL refuses non-disposable targets.
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'../database/replay');
function build(raw,catalog,overrides){
  const migrations=raw.split(/^-- ===== /m).slice(1).map(part=>{
    const first=part.indexOf('\n');
    const header=/^(\d{14}) ([a-z0-9_]+) =====$/.exec(part.slice(0,first));
    if(!header)throw Error('Invalid migration header');
    return {version:header[1],name:header[2],sql:part.slice(first+1).trim()};
  });
  if(migrations.length!==39 || new Set(migrations.map(x=>x.version)).size!==39 || migrations.some((x,i)=>i>0 && x.version<=migrations[i-1].version))throw Error('Unexpected migration inventory');
  const ident=s=>{if(!/^[a-z_][a-z_0-9]*$/.test(s))throw Error('Invalid identifier');return '"'+s+'"';};
  const lookup=(list,name)=>{const found=list.filter(x=>x.name===name);if(found.length!==1)throw Error('Missing or duplicate '+name);return found[0];};
  const lines=[`-- LOCAL DISPOSABLE DEMO ONLY. Not a production migration.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'mwd_demo_isolated' OR
 (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM 'MWD_DISPOSABLE_CONCURRENCY_TEST_ONLY'
 THEN RAISE EXCEPTION 'Refusing non-disposable database'; END IF;
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname LIKE 'mwd_%' OR nspname IN ('auth','extensions')) OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname LIKE 'mwd_%') THEN RAISE EXCEPTION 'Database must be empty'; END IF;
END $guard$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
-- SQL test double, not Supabase Auth: only fields and identity lookup required by migrations.
CREATE TABLE auth.users(id uuid PRIMARY KEY,aud text,role text,email text UNIQUE,encrypted_password text,created_at timestamptz,updated_at timestamptz);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $uid$
 SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub',true),''),(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid
$uid$;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
REVOKE ALL ON auth.users FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA auth TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
COMMIT;`];
  function transaction(label,sql){lines.push('-- '+label,'BEGIN;',sql.trim().replace(/;?$/,';'),'COMMIT;');}
  function ledger(){
    let s=['CREATE SCHEMA mwd_finance_private;','REVOKE ALL ON SCHEMA mwd_finance_private FROM PUBLIC,anon,authenticated;'];
    for(const name of ['ledger_accounts','ledger_transactions','ledger_entries']){
      const t=lookup(catalog.relations,name);
      if(t.schema!=='mwd_finance_private'||t.relkind!=='r'||!t.relrowsecurity||t.columns.some(c=>c.identity||c.generated))throw Error('Unexpected ledger table metadata');
      const parts=t.columns.map(c=>ident(c.name)+' '+c.type+(c.default?' DEFAULT '+c.default:'')+(c.notnull?' NOT NULL':''));
      parts.push(...t.constraints.map(c=>'CONSTRAINT '+ident(c.name)+' '+c.definition));
      const target='mwd_finance_private.'+ident(name);
      s.push('CREATE TABLE '+target+' (\n'+parts.join(',\n')+'\n);','ALTER TABLE '+target+' ENABLE ROW LEVEL SECURITY;','REVOKE ALL ON '+target+' FROM PUBLIC,anon,authenticated;');
    }
    for(const name of ['enforce_posted_balance','protect_posted_entries','protect_posted_transactions','post_demo_transfer_ledger_v1']){
      const f=lookup(catalog.functions,name);s.push(f.definition.trim()+';','REVOKE ALL ON FUNCTION mwd_finance_private.'+ident(name)+'() FROM PUBLIC,anon,authenticated;');
    }
    for(const t of catalog.triggers)s.push(t.definition+';');
    return s.join('\n');
  }
  function remaining(){
    let s=[];
    for(const name of ['ledger_balance_check','demo_operations_audit_v1','demo_transfer_reconciliation_v1','demo_ledger_backfill_readiness_v1','demo_wallet_reconciliation_v1','demo_wallet_opening_audit_v1','demo_wallet_alerts_v1']){
      const v=lookup(catalog.relations,name);if(v.relkind!=='v'||v.schema!=='mwd_finance_private')throw Error('Unexpected view metadata');
      const target='mwd_finance_private.'+ident(name);
      s.push('CREATE VIEW '+target+' WITH (security_invoker=true) AS '+v.view_definition.trim().replace(/;?$/,';'),'REVOKE ALL ON '+target+' FROM PUBLIC,anon,authenticated;');
    }
    for(const name of ['mwd_owner_accounting_alerts_demo','mwd_pending_recipient_check_demo']){
      const f=lookup(catalog.functions,name);
      const signature='public.'+ident(name)+'('+(name==='mwd_pending_recipient_check_demo'?'uuid,text':'')+')';
      s.push(f.definition.trim()+';','REVOKE ALL ON FUNCTION '+signature+' FROM PUBLIC,anon,authenticated;','GRANT EXECUTE ON FUNCTION '+signature+' TO authenticated,service_role;');
    }
    return s.join('\n');
  }
  let previous=null,applied=0;
  for(const m of migrations){
    if(m.version==='20261012201539')transaction('Restore missing original ledger objects from current catalog',ledger());
    if(m.version==='20261015185235'){
      if(previous?.version!=='20261015185227'||previous.sql!==m.sql)throw Error('Duplicate migration is no longer identical');
      lines.push('-- Skip exact duplicate '+m.version+'; original migration is already applied.');
    }else{transaction(m.version+' '+m.name,m.sql);applied++;}
    previous=m;
  }
  if(applied!==38)throw Error('Unexpected replay count');
  transaction('Restore remaining private views and two RPC definitions',remaining());
  const expected={
    mwd_get_payment_request_demo:'uuid',
    mwd_owner_partner_audit_feed_demo:'text,uuid,integer',
    mwd_owner_partner_location_save_demo:'uuid,text,text,text,text,uuid'
  };
  if(!Array.isArray(overrides)||overrides.length!==3)throw Error('Missing current RPC overrides');
  const patches=[];
  for(const name of Object.keys(expected)){
    const f=lookup(overrides,name);
    if(!f.definition.startsWith('CREATE OR REPLACE FUNCTION public.'+name+'('))throw Error('Unexpected override definition');
    const signature='public.'+ident(name)+'('+expected[name]+')';
    patches.push(f.definition.trim()+';','REVOKE ALL ON FUNCTION '+signature+' FROM PUBLIC,anon,authenticated;','GRANT EXECUTE ON FUNCTION '+signature+' TO authenticated,service_role;');
  }
  transaction('Restore current hardened RPCs',patches.join('\n'));
  return lines.join('\n\n')+'\n';
}
if(require.main===module){
 const raw=fs.readFileSync(path.join(base,'migration-history-20261126.txt'),'utf8');
 const catalog=JSON.parse(fs.readFileSync(path.join(base,'catalog-missing-objects-20261126.json'),'utf8'));
 const overrides=JSON.parse(fs.readFileSync(path.join(base,'current-rpc-overrides-20261126.json'),'utf8'));
 process.stdout.write(build(raw,catalog,overrides));
}
module.exports={build};
