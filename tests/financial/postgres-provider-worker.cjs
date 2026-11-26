'use strict';
// Integration harness: Docker CI only. No URLs, secrets, production connections.
const {execFile,execFileSync}=require('node:child_process');
const {promisify}=require('node:util');
const assert=require('node:assert/strict');
const {createWorker}=require('../../financial-sandbox/provider-worker.cjs');
const {openDurableProvider}=require('../../financial-sandbox/durable-provider.cjs');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');
const container=process.env.LAB_CONTAINER;
if(!/^[a-f0-9]{12,64}$/.test(container||''))throw Error('CI_LAB_REQUIRED');
const schema='mwd_financial_lab';
const lit=s=>"convert_from(decode('"+Buffer.from(String(s),'utf8').toString('hex')+"','hex'),'UTF8')";
const roleNames=new Set(['order','dispatch','event','audit']);
function sql(q,role){
 if(role&&!roleNames.has(role))throw Error('INVALID_ROLE');
 return execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','lab','-d','mwd_financial_sandbox_test'],{input:(role?'SET ROLE mwd_lab_'+role+'_service;\n':'')+q+';\n',encoding:'utf8'}).trim();
}
function store(){
 return {
  claim(){const r=sql('SELECT row_to_json(t) FROM '+schema+'.claim_dispatch(30) t','dispatch');if(!r)return null;const x=JSON.parse(r);return {intent:{mode:'sandbox',orderId:x.order_id,reference:x.reference,kind:x.kind,currency:x.currency,amountMinor:Number(x.amount_minor)},token:x.token,attempt:Number(x.attempts)};},
  checkLease(ref,token){return sql('SELECT '+schema+'.check_dispatch_lease('+lit(ref)+','+lit(token)+'::uuid)','dispatch')==='t';},
  ack(ref,token){sql('SELECT '+schema+'.acknowledge_dispatch('+lit(ref)+','+lit(token)+'::uuid)','dispatch');},
  record(e){return sql('SELECT '+schema+'.record_verified_event('+[e.provider,e.eventId,e.reference,e.outcome,e.currency].map(lit).join(',')+','+e.amountMinor+')','event');}
 };
}
async function withDispatchLock({lockRow,applicationName,hold},action){
 const lock=promisify(execFile)('docker',['exec',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','lab','-d','mwd_financial_sandbox_test','-c',`
  BEGIN;
  SET LOCAL statement_timeout='12s';
  ${lockRow};
  SELECT pg_advisory_xact_lock(60261126,100);
  DO $$
  BEGIN
   LOOP
    PERFORM pg_stat_clear_snapshot();
    EXIT WHEN EXISTS (
     SELECT FROM pg_stat_activity WHERE application_name=${lit(applicationName)}
      AND pg_backend_pid()=ANY(pg_blocking_pids(pid))
    );
    PERFORM pg_sleep(0.05);
   END LOOP;
  END $$;
  ${hold};
  ROLLBACK;
 `],{timeout:15000}).then(()=>null,error=>error);
 try{
  let ready=false;
  for(let attempt=0;attempt<40;attempt++){
   if(sql('SELECT pg_try_advisory_lock(60261126,100)')==='f'){ready=true;break;}
   await delay(50);
  }
  assert.equal(ready,true,'dispatch locker did not acquire the row');
  return action(query=>sql(
   "SET application_name='"+applicationName+"'; SET statement_timeout='15s'; "+query,'dispatch'
  ));
 }finally{
  const error=await lock;
  if(error)throw error;
 }
}
async function assertAckExpiresWhileWaiting(reference){
 const ref=lit(reference);
 const token=sql('SELECT token FROM '+schema+'.dispatch WHERE reference='+ref);
 sql("UPDATE "+schema+".dispatch SET lease_until=clock_timestamp()+interval '5 seconds' WHERE reference="+ref);
 await withDispatchLock({
  lockRow:`SELECT 1 FROM ${schema}.dispatch WHERE reference=${ref} FOR NO KEY UPDATE`,
  applicationName:'mwd-late-transport-ack',
  hold:`SELECT pg_sleep_until(lease_until+interval '100 milliseconds') FROM ${schema}.dispatch WHERE reference=${ref}`
 },contend=>{
  assert.throws(()=>contend('SELECT '+schema+'.acknowledge_dispatch('+ref+','+lit(token)+'::uuid)'),/STALE_LEASE/);
 });
 assert.equal(sql('SELECT state FROM '+schema+'.dispatch WHERE reference='+ref),'leased');
}
async function assertClaimStartsAfterControlLock(reference){
 const result=await withDispatchLock({
  lockRow:`SELECT 1 FROM ${schema}.dispatch_control WHERE singleton FOR UPDATE`,
  applicationName:'mwd-delayed-dispatch-claim',
  hold:'SELECT pg_sleep(3.1)'
 },contend=>contend(
  'SELECT reference, attempts, lease_until>clock_timestamp() FROM '+schema+'.claim_dispatch(3)'
 ));
 assert.equal(result,reference+'|1|t','waiting for dispatch control must not spend the new lease');
 sql("UPDATE "+schema+".dispatch SET lease_until=clock_timestamp()-interval '1 second' WHERE reference="+lit(reference));
}
function state(order){return sql('SELECT state FROM '+schema+'.orders WHERE id='+lit(order)+'::uuid');}
function openOrder(actor){
 sql("INSERT INTO "+schema+".actor_policy VALUES ("+lit(actor)+",'verified','clear','allow',50000)");
 sql("INSERT INTO "+schema+".beneficiaries VALUES ("+lit(actor)+",'synthetic-beneficiary','verified')");
 const q=sql('SELECT quote_id FROM '+schema+'.issue_quote('+lit(actor)+",'synthetic-beneficiary',10000)",'order');
 return sql('SELECT '+schema+'.accept_quote('+lit(actor)+",'request',"+lit(q)+"::uuid,'sandbox-disclosure-v1')",'order');
}
function prepare(actor,order,kind){return sql('SELECT '+schema+'.prepare_authorized('+lit(actor)+','+lit(order)+'::uuid,'+lit(kind)+')','order');}
async function main(){
 assert.equal(sql('SELECT current_database()'),'mwd_financial_sandbox_test');
 const dir=mkdtempSync(join(tmpdir(),'mwd-e2e-provider-'));
 const config={environment:'sandbox',path:join(dir,'provider.sqlite'),secret:'synthetic-ci-only-worker-secret-no-real-credentials'};
 let p=openDurableProvider({...config,initialize:true});
 try{
 let worker=createWorker({environment:'sandbox',store:store(),provider:p});
 const order=openOrder('workerPaid');
 await assertClaimStartsAfterControlLock(order+'-funding');
 p.loseNextResponse();
 await assert.rejects(worker.tick(),/SIMULATED_RESPONSE_LOSS/);
 assert.equal(p.submissions().length,1);assert.equal(state(order),'funding_pending');
 // Restart the independent provider and the disposable PostgreSQL service.
 p.close();p=null;
 execFileSync('docker',['restart',container],{timeout:30000});
 let ready=false;
 for(let attempt=0;attempt<40;attempt++){
  try{execFileSync('docker',['exec',container,'pg_isready','-U','lab','-d','mwd_financial_sandbox_test'],{stdio:'ignore',timeout:3000});ready=true;break;}catch{await delay(500);}
 }
 assert.equal(ready,true,'database failed to recover');
 p=openDurableProvider(config);
 assert.equal((await p.lookup(order+'-funding')).status,'accepted');
 assert.equal(state(order),'funding_pending');
 // A transport acknowledgment starts before expiry but reaches the locked row
 // too late. Recovery must reclaim the expired lease with a new token.
 await assertAckExpiresWhileWaiting(order+'-funding');
 worker=createWorker({environment:'sandbox',store:store(),provider:p});
 assert.equal((await worker.tick()).status,'transport_acknowledged');
 assert.equal(p.submissions().length,1);assert.equal(state(order),'funding_pending');
 const f=p.event(order+'-funding','funding_confirmed','worker-fund-1');
 await assert.rejects(worker.receive(f.raw,'0'.repeat(64)),/INVALID_SIGNATURE/);
 assert.equal(await worker.receive(f.raw,f.signature),'funded');
 assert.equal(await worker.receive(f.raw,f.signature),'duplicate');
 prepare('workerPaid',order,'payout');
 const payoutRef=order+'-payout';
 const payoutState=()=>sql('SELECT state FROM '+schema+'.dispatch WHERE reference='+lit(payoutRef));
 const expirePayoutLease=()=>sql(
  "UPDATE "+schema+".dispatch SET lease_until=clock_timestamp()-interval '1 second' WHERE reference="+lit(payoutRef)
 );
 p.loseNextResponse();
 await assert.rejects(worker.tick(),/SIMULATED_RESPONSE_LOSS/);
 assert.equal((await p.lookup(payoutRef)).status,'awaiting_confirmation');
 assert.equal(payoutState(),'leased');
 assert.equal(state(order),'payout_pending');
 expirePayoutLease();

 // Lose the confirmation response after the provider has committed it.
 p.loseNextResponse();
 await assert.rejects(worker.tick(),/SIMULATED_RESPONSE_LOSS/);
 assert.equal((await p.lookup(payoutRef)).status,'accepted');
 assert.equal(payoutState(),'leased');
 assert.equal(state(order),'payout_pending');
 assert.equal(sql('SELECT count(*) FROM '+schema+'.journal WHERE order_id='+lit(order)+'::uuid'),'1');
 expirePayoutLease();

 p.close();p=null;
 p=openDurableProvider(config);
 worker=createWorker({environment:'sandbox',store:store(),provider:p});
 assert.equal((await worker.tick()).status,'transport_acknowledged');
 assert.equal(payoutState(),'acknowledged');
 assert.equal(sql('SELECT attempts FROM '+schema+'.dispatch WHERE reference='+lit(payoutRef)),'3');
 assert.equal(p.submissions().filter(i=>i.reference===payoutRef).length,1);
 assert.equal(state(order),'payout_pending');
 const pay=p.event(payoutRef,'payout_confirmed','worker-pay-1');
 assert.equal(await worker.receive(pay.raw,pay.signature),'paid');assert.equal(state(order),'paid');
 const refund=openOrder('workerRefund');
 // A signed settlement can arrive before the transport acknowledgment. Simulate
 // a stale lease at that boundary; settlement must not be reversed or resent.
 const earlyStore=store();
 let earlyEvent;
 const earlyWorker=createWorker({environment:'sandbox',provider:p,store:{...earlyStore,
  async ack(ref,token){
   assert.equal(ref,refund+'-funding');
   earlyEvent=p.event(ref,'funding_confirmed','worker-fund-2');
   assert.equal(await worker.receive(earlyEvent.raw,earlyEvent.signature),'funded');
   sql("UPDATE "+schema+".dispatch SET lease_until=clock_timestamp()-interval '1 second' WHERE reference="+lit(ref));
   earlyStore.ack(ref,token);
  }
 }});
 await assert.rejects(earlyWorker.tick(),/STALE_LEASE/);
 assert.equal(state(refund),'funded');
 assert.equal(await worker.receive(earlyEvent.raw,earlyEvent.signature),'duplicate');
 assert.equal((await worker.tick()).status,'idle');
 assert.equal(p.submissions().filter(i=>i.reference===refund+'-funding').length,1);
 assert.equal(sql('SELECT count(*) FROM '+schema+'.journal WHERE order_id='+lit(refund)+'::uuid'),'1');
 prepare('workerRefund',refund,'payout');
 const uncertainRef=refund+'-payout';
 // The provider committed confirmation, but lookup stays unavailable until
 // the whole lease budget expires. No second submission or inference is safe.
 const uncertainIntent={mode:'sandbox',reference:uncertainRef,orderId:refund,kind:'payout',currency:'HNL',amountMinor:250000};
 await p.submit(uncertainIntent);
 await p.confirmPayout(uncertainIntent);
 const uncertainWorker=createWorker({environment:'sandbox',store:store(),provider:{
  ...p,
  async lookup(ref){assert.equal(ref,uncertainRef);return {status:'unknown'};},
  async submit(){assert.fail('unknown provider status must not be submitted');},
  async confirmPayout(){assert.fail('unknown provider status must not be confirmed again');}
 }});
 for(let attempt=1;attempt<=3;attempt++){
  assert.equal((await uncertainWorker.tick()).status,'provider_uncertain');
  assert.equal(state(refund),'payout_pending');
  assert.equal(sql('SELECT attempts FROM '+schema+'.dispatch WHERE reference='+lit(uncertainRef)),String(attempt));
  sql("UPDATE "+schema+".dispatch SET lease_until=clock_timestamp()-interval '1 second' WHERE reference="+lit(uncertainRef));
 }
 assert.equal((await worker.tick()).status,'idle');
 assert.equal(sql('SELECT operations FROM '+schema+".dispatch_attention WHERE kind='payout' AND reason='retry_budget_exhausted'","audit"),'1');
 assert.equal(sql('SELECT count(*) FROM '+schema+'.journal WHERE order_id='+lit(refund)+'::uuid'),'1');
 const fail=p.event(uncertainRef,'payout_failed','worker-pay-2');
 assert.equal(await worker.receive(fail.raw,fail.signature),'payout_failed');
 prepare('workerRefund',refund,'refund');await worker.tick();
 const r=p.event(refund+'-refund','refund_confirmed','worker-refund-2');
 assert.equal(await worker.receive(r.raw,r.signature),'refunded');
 assert.equal(state(refund),'refunded');
 assert.equal(p.submissions().length,5);
 assert.equal((await worker.tick()).status,'idle');
 assert.equal(sql('SELECT sum(payable) FROM '+schema+'.journal WHERE order_id IN ('+lit(order)+'::uuid,'+lit(refund)+'::uuid)'),'0');
 assert.equal(sql('SELECT sum(revenue) FROM '+schema+'.journal WHERE order_id IN ('+lit(order)+'::uuid,'+lit(refund)+'::uuid)'),'-150');
 console.log('Sandbox worker: signed funding, payout, refund and PostgreSQL/provider restart recovery verified');
 }finally{if(p)p.close();rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
