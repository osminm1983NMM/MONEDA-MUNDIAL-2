#!/usr/bin/env node
'use strict';
// COMMITS synthetic data, exclusively in the explicitly marked disposable database.
const { spawn, spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const assert = require('node:assert/strict');
const args=['-X','-w','-qAt','-h','127.0.0.1','-p','54322','-U','postgres','-d','mwd_demo_isolated','-v','ON_ERROR_STOP=1'];
const env={PATH:process.env.PATH,PGPASSWORD:process.env.MWD_LOCAL_DB_PASSWORD,PGCONNECT_TIMEOUT:'5',PGOPTIONS:'-c statement_timeout=20000 -c lock_timeout=15000 -c idle_in_transaction_session_timeout=25000'};
const a='f1a00000-0000-4000-8000-000000000001', b='f1a00000-0000-4000-8000-000000000002';
const uuid=s=>{assert.match(s,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);return "'"+s+"'::uuid";};
function query(sql) {
 const r=spawnSync('psql',[...args,'-c',sql],{env,encoding:'utf8',timeout:25000});
 if(r.error||r.status!==0) throw Error('Local merchant SQL failed: '+(r.stderr||'').slice(0,350));
 return r.stdout.trim();
}
const auth=id=>"SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '"+id+"'; SET LOCAL request.jwt.claims = '{\"sub\":\""+id+"\",\"role\":\"authenticated\"}';";
function guarded() {
 assert.equal(query("SELECT current_database()||':'||coalesce(shobj_description(oid,'pg_database'),'') FROM pg_database WHERE datname=current_database()"),'mwd_demo_isolated:MWD_DISPOSABLE_CONCURRENCY_TEST_ONLY');
 assert.equal(query("SELECT count(*) FROM mwd_finance_private.demo_fee_routes WHERE real_payments_enabled IS DISTINCT FROM false"),'0');
 assert.equal(query("SELECT count(*) FROM auth.users"),'2');
 assert.equal(query("SELECT count(*) FROM auth.users WHERE (id="+uuid(a)+" AND email='fixture-a@example.invalid' OR id="+uuid(b)+" AND email='fixture-b@example.invalid') AND coalesce(encrypted_password,'')=''"),'2');
 assert.equal(query("SELECT count(*) FROM public.mwd_wallets"),'2');
 assert.equal(query("SELECT count(*) FROM public.mwd_wallets WHERE user_id IN ("+uuid(a)+","+uuid(b)+")"),'2');
 assert.equal(query("SELECT count(*) FROM public.mwd_merchants"),'0');
 assert.equal(query("SELECT count(*) FROM public.mwd_payment_requests"),'0');
}
function session(sql,name){
 let out='',err='';
 const proc=spawn('psql',args,{env:{...env,PGAPPNAME:name},stdio:['pipe','pipe','pipe']});
 const completed=new Promise((resolve,reject)=>{
  proc.on('error',reject);
  proc.stdout.setEncoding('utf8');proc.stderr.setEncoding('utf8');
  proc.stdout.on('data',s=>out+=s);proc.stderr.on('data',s=>err+=s);
  proc.on('close',code=>code===0?resolve(out):reject(Error('Concurrent merchant SQL failed: '+err.slice(0,350))));
 });
 completed.catch(()=>{});proc.stdin.on('error',()=>{});proc.stdin.end(sql+'\n');
 return {proc,completed,output:()=>out};
}
function parse(out){const row=out.split(/\r?\n/).find(l=>l.startsWith('{'));assert.ok(row,'Missing payment result');return JSON.parse(row);}
function balance(id){return BigInt(query("SELECT balance_cents FROM public.mwd_wallets WHERE user_id="+uuid(id)));}
async function main(){
 if(process.env.MWD_CONFIRM_ISOLATED!=='YES_LOCAL_DISPOSABLE'||!process.env.MWD_LOCAL_DB_PASSWORD)throw Error('Explicit disposable database confirmation required');
 guarded();
 const amount=100n, beforeA=balance(a), beforeB=balance(b), ref=randomUUID(), tag='mwdmerchant_'+ref.replaceAll('-','');
 assert.ok(beforeA>=amount);
 query("BEGIN; "+auth(b)+" INSERT INTO public.mwd_merchants(owner_user_id,business_name,country_code) VALUES("+uuid(b)+",'Concurrent synthetic merchant','HN'); INSERT INTO public.mwd_payment_requests(id,merchant_user_id,amount_cents) VALUES("+uuid(ref)+","+uuid(b)+",100); COMMIT;");
 const rpc="public.mwd_pay_merchant_demo("+uuid(ref)+")";
 const first=session("BEGIN; "+auth(a)+" SELECT "+rpc+"; SELECT 'FIRST_HELD'; SELECT pg_sleep(8); COMMIT;",tag+'_a');
 let second;
 try{
  for(let i=0;i<100&&!first.output().includes('FIRST_HELD');i++){
   if(first.proc.exitCode!==null)throw Error('First payment ended before barrier');
   await delay(50);
  }
  assert.ok(first.output().includes('FIRST_HELD'),'First payment did not reach barrier');
  second=session("BEGIN; "+auth(a)+" SELECT "+rpc+"; COMMIT;",tag+'_b');
  let blocked=false;
  for(let i=0;i<30;i++){
   if(query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='"+tag+"_b' AND wait_event_type='Lock')")==='t'){blocked=true;break;}
   if(second.proc.exitCode!==null)break;
   await delay(100);
  }
  assert.ok(blocked,'Concurrent lock wait not observed');
  const [x,y]=(await Promise.all([first.completed,second.completed])).map(parse);
  assert.equal(x.status,'ok');assert.equal(y.status,'already_processed');
  assert.equal(x.payment_id,ref);assert.equal(y.payment_id,ref);
  assert.equal(balance(a),beforeA-amount);assert.equal(balance(b),beforeB+amount);
  assert.equal(query("SELECT status FROM public.mwd_payment_requests WHERE id="+uuid(ref)),'paid');
  assert.equal(query("SELECT count(*) FROM public.mwd_operations WHERE request_id="+uuid(ref)),'1');
  assert.equal(query("SELECT count(*) FROM public.mwd_operations WHERE request_id="+uuid(ref)+" AND actor_id="+uuid(a)+" AND source_user_id="+uuid(a)+" AND destination_user_id="+uuid(b)+" AND amount_cents=100 AND kind='transfer'"),'1');
  console.log('PASS merchant concurrent retry: observed lock contention, one payment, one debit and one credit; discard database.');
 }finally{for(const s of [first,second])if(s&&s.proc.exitCode===null)s.proc.kill();}
}
main().catch(e=>{console.error('FAIL: '+e.message);process.exitCode=1;});
