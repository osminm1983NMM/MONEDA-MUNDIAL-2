#!/usr/bin/env node
'use strict';
// Only for a disposable, locally provisioned DEMO database. COMMITS test data.
const { spawn, spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const args = ['-X','-w','-qAt','-h','127.0.0.1','-p','54322','-U','postgres','-d','mwd_demo_isolated','-v','ON_ERROR_STOP=1'];
const env = { PATH:process.env.PATH, PGPASSWORD:process.env.MWD_LOCAL_DB_PASSWORD, PGCONNECT_TIMEOUT:'5', PGOPTIONS:'-c statement_timeout=20000 -c lock_timeout=15000 -c idle_in_transaction_session_timeout=25000' };
const uuid = s => { assert.match(s,/^[a-f0-9-]{36}$/i); return "'" + s + "'::uuid"; };
const code = s => { assert.match(s,/^MWD-[A-F0-9]{16}$/); return "'" + s + "'"; };
function admin(sql) {
  const r=spawnSync('psql',[...args,'-c',sql],{env,encoding:'utf8',timeout:25000});
  if(r.error || r.status!==0) throw Error('Local psql query failed; inspect the isolated database.');
  return r.stdout.trim();
}
function identity(id) {
  return "SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '" + id + "'; SET LOCAL request.jwt.claims = '{\"sub\":\"" + id + "\",\"role\":\"authenticated\"}';";
}
function guarded() {
  assert.equal(admin("SELECT current_database()||':'||coalesce(shobj_description(oid,'pg_database'),'') FROM pg_database WHERE datname=current_database()"),'mwd_demo_isolated:MWD_DISPOSABLE_CONCURRENCY_TEST_ONLY','Local database must have the explicit disposable marker');
  assert.equal(admin("SELECT count(*) FROM mwd_finance_private.demo_fee_routes WHERE real_payments_enabled IS DISTINCT FROM false"),'0','Real payments must be off');
}
function session(sql,name) {
  let output='', err='';
  const proc=spawn('psql',args,{env:{...env,PGAPPNAME:name},stdio:['pipe','pipe','pipe']});
  const completed=new Promise((resolve,reject)=>{
    proc.on('error',reject);
    proc.stdout.setEncoding('utf8');proc.stderr.setEncoding('utf8');
    proc.stdout.on('data',s=>output+=s);proc.stderr.on('data',s=>err+=s);
    proc.on('close',status=>status===0?resolve(output):reject(Error('Local concurrent SQL failed ('+status+'): '+err.slice(0,300))));
  });
  // Avoid unhandled rejection while waiting for the lock observation.
  completed.catch(()=>{});
  proc.stdin.on('error',()=>{});
  proc.stdin.end(sql+'\n');
  return {proc,completed,output:()=>output};
}
function result(text) {
  const row=text.split(/\r?\n/).find(s=>s.startsWith('{'));
  if(!row) throw Error('Missing RPC result');
  return JSON.parse(row);
}
async function pair(actor, rpc, firstStatus, secondStatus, idKey) {
  const tag='mwdtest_'+randomUUID().replaceAll('-','');
  const a=session('BEGIN; '+identity(actor)+' SELECT '+rpc+"; SELECT 'FIRST_HELD'; SELECT pg_sleep(8); COMMIT;",tag+'_a');
  let b;
  try {
    for(let i=0;i<100 && !a.output().includes('FIRST_HELD');i++) {
      if(a.proc.exitCode!==null) throw Error('First session ended early');
      await delay(50);
    }
    assert.ok(a.output().includes('FIRST_HELD'),'First transaction did not reach barrier');
    b=session('BEGIN; '+identity(actor)+' SELECT '+rpc+'; COMMIT;',tag+'_b');
    let blocked=false;
    for(let i=0;i<30;i++){
      if(admin("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='"+tag+"_b' AND wait_event_type='Lock')")==='t'){blocked=true;break;}
      if(b.proc.exitCode!==null)break;
      await delay(100);
    }
    assert.ok(blocked,'No overlapping lock wait observed; concurrency not certified');
    const [x,y]=await Promise.all([a.completed,b.completed]).then(values=>values.map(result));
    assert.equal(x.status,firstStatus); assert.equal(y.status,secondStatus);
    assert.ok(x[idKey]);assert.equal(x[idKey],y[idKey]);
    return [x,y];
  } finally {
    for(const s of [a,b]) if(s && s.proc.exitCode===null) s.proc.kill();
  }
}
function wallet(id){return BigInt(admin("SELECT balance_cents FROM public.mwd_wallets WHERE user_id="+uuid(id)));}
function opCount(id,ref){return admin("SELECT count(*) FROM public.mwd_operations WHERE actor_id="+uuid(id)+" AND request_id="+uuid(ref));}
async function main() {
  if(process.env.MWD_CONFIRM_ISOLATED!=='YES_LOCAL_DISPOSABLE'||!process.env.MWD_LOCAL_DB_PASSWORD) throw Error('Explicit disposable database confirmation and password required');
  guarded();
  const fixture=JSON.parse(admin("SELECT jsonb_build_object('a',a.user_id,'b',b.user_id,'code',b.account_code) FROM public.mwd_wallets a CROSS JOIN public.mwd_wallets b WHERE a.user_id<>b.user_id AND a.balance_cents>=2 AND b.balance_cents<99999999999 ORDER BY a.user_id,b.user_id LIMIT 1"));
  const {a,b}=fixture;uuid(a);uuid(b);code(fixture.code);
  let beforeA=wallet(a),beforeB=wallet(b),ref=randomUUID();
  await pair(a,"public.mwd_transfer_demo("+code(fixture.code)+",1,"+uuid(ref)+")",'ok','already_processed','operation_id');
  assert.equal(wallet(a),beforeA-1n);assert.equal(wallet(b),beforeB+1n);assert.equal(opCount(a,ref),'1');
  console.log('PASS transfer: observed lock contention, one debit and one credit');
  beforeA=wallet(a);ref=randomUUID();
  await pair(a,"public.mwd_contribute_demo(1,"+uuid(ref)+")",'ok','already_processed','operation_id');
  assert.equal(wallet(a),beforeA-1n);assert.equal(opCount(a,ref),'1');
  console.log('PASS contribution: observed lock contention, one debit');
  const swap=JSON.parse(admin("SELECT jsonb_build_object('user',user_id,'asset',asset_code) FROM mwd_swap_private.demo_balances WHERE balance_micro>=1000000 AND asset_code IN ('COIN','STABLE') ORDER BY user_id,asset_code LIMIT 1"));
  uuid(swap.user);assert.ok(['COIN','STABLE'].includes(swap.asset));
  ref=randomUUID();
  const quoted=result(admin("BEGIN; "+identity(swap.user)+" SELECT public.mwd_conversion_quote_demo('"+swap.asset+"',1000000,"+uuid(ref)+"); COMMIT;"));
  const q=uuid(quoted.quoteId);
  assert.equal(quoted.realPaymentsEnabled,false);
  const balances=()=>JSON.parse(admin("SELECT jsonb_object_agg(asset_code,balance_micro::text) FROM mwd_swap_private.demo_balances WHERE user_id="+uuid(swap.user)));
  const start=balances();
  const [converted]=await pair(swap.user,"public.mwd_conversion_confirm_demo("+q+")",'ok','already_processed','conversionId');
  const end=balances();
  assert.equal(BigInt(end[quoted.fromAsset]),BigInt(start[quoted.fromAsset])-BigInt(quoted.amountInMicro));
  assert.equal(BigInt(end[quoted.toAsset]),BigInt(start[quoted.toAsset])+BigInt(quoted.amountOutMicro));
  assert.equal(admin("SELECT count(*) FROM mwd_swap_private.demo_conversions WHERE quote_id="+q),'1');
  assert.equal(admin("SELECT count(*) FROM mwd_swap_private.demo_journal WHERE conversion_id="+uuid(converted.conversionId)),'4');
  console.log('PASS conversion: observed lock contention, one conversion and four journal entries');
  const sender=admin("SELECT w.user_id FROM public.mwd_wallets w WHERE (SELECT count(*) FROM mwd_pickup_private.demo_orders o WHERE o.sender_user_id=w.user_id AND o.created_at>clock_timestamp()-interval '1 hour')<5 LIMIT 1");
  uuid(sender);ref=randomUUID();
  const [created,retried]=await pair(sender,"public.mwd_pickup_create_demo('HN',100,"+uuid(ref)+")",'created','already_created','orderId');
  assert.equal(created.realPaymentsEnabled,false);assert.equal(created.isFunded,false);assert.equal(created.canPayOut,false);assert.equal(retried.pickupCode,null);
  assert.equal(admin("SELECT count(*) FROM mwd_pickup_private.demo_orders WHERE sender_user_id="+uuid(sender)+" AND client_request_id="+uuid(ref)),'1');
  console.log('PASS pickup: observed lock contention, one unfunded order');
  console.log('PASS four concurrent scenarios. Discard this local database; test transactions were committed.');
}
if(require.main===module) main().catch(e=>{console.error('FAIL: '+e.message);process.exitCode=1;});
