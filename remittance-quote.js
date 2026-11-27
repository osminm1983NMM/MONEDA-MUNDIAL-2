'use strict';
// Read-only simulator: USD inputs, no payout, no fabricated exchange rates.
function centsFromInput(value){
 if(typeof value!=='string')return null;
 const s=value.trim().replace(',','.');
 if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;
 const [whole,fraction='']=s.split('.');
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(cents)&&cents>=100&&cents<=10000000?cents:null;
}
function parseCountries(value){
 if(!Array.isArray(value)||value.length===0||value.length>300)throw Error('Invalid country catalog');
 const seen=new Set(), available=[];
 for(const c of value){
  if(!c||typeof c.code!=='string'||!/^[A-Z]{2}$/.test(c.code)||typeof c.name!=='string'||!c.name.trim()||typeof c.demoAvailable!=='boolean'||c.realPaymentsEnabled!==false||seen.has(c.code))throw Error('Invalid country record');
  seen.add(c.code);
  if(c.demoAvailable)available.push({code:c.code,name:c.name});
 }
 if(!available.length)throw Error('No simulation routes');
 return available;
}
function parseQuote(q,expected){
 if(!q||q.status!=='simulation_only'||q.realPaymentsEnabled!==false||q.origin!=='US'||q.sourceCurrency!=='USD'||q.destination!==expected.country||q.method!==expected.method||q.amountCents!==expected.cents||typeof q.destinationCurrency!=='string'||!/^[A-Z]{3}$/.test(q.destinationCurrency))throw Error('Unexpected quote');
 if(!Number.isSafeInteger(q.feeCents)||q.feeCents<0||!Number.isSafeInteger(q.totalPayCents)||q.totalPayCents!==expected.cents+q.feeCents)throw Error('Invalid quote totals');
 if(q.destinationCurrency==='USD'){
  if(q.fxRate!==1||q.receiverAmountCents!==expected.cents)throw Error('Invalid USD quote');
 }else if(q.fxRate!==null||q.receiverAmountCents!==null)throw Error('Unverified foreign exchange quote');
 // Never retain owner-only economics or other unrecognized server fields.
 return {country:expected.country,method:expected.method,amountCents:q.amountCents,feeCents:q.feeCents,totalPayCents:q.totalPayCents,destinationCurrency:q.destinationCurrency,receiverAmountCents:q.receiverAmountCents};
}
function makeRequestGate(){
 let generation=0,controller=null;
 const current=token=>controller!==null&&token===generation;
 return {
  begin(){if(controller)return null;controller=new AbortController();return ++generation;},
  isLatest:current,
  signal(token){if(!current(token))throw Error('QUOTE_CANCELLED');return controller.signal;},
  finish(token){if(!current(token))return false;controller=null;return true;},
  invalidate(){const old=controller;generation++;controller=null;old?.abort();}
 };
}
// Share bounded read capacity across screen mounts. A timed-out transport
// retains its slot until it actually settles, even if it ignores cancellation.
function createQuoteReader(maxActive=4){
 if(!Number.isInteger(maxActive)||maxActive<1||maxActive>16)throw Error('Invalid quote capacity');
 let active=0;
 return async function withQuoteDeadline(request,timeoutMs=15000,externalSignal){
  if(typeof request!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('Invalid quote deadline');
  if(externalSignal?.aborted)throw Error('QUOTE_CANCELLED');
  if(active>=maxActive)throw Error('QUOTE_BUSY');
  const controller=new AbortController();
  let timer,cancel;
  const deadline=new Promise((_,reject)=>{
   cancel=()=>{reject(Error('QUOTE_CANCELLED'));controller.abort();};
   timer=setTimeout(()=>{reject(Error('QUOTE_TIMEOUT'));controller.abort();},timeoutMs);
  });
  externalSignal?.addEventListener('abort',cancel,{once:true});
  active++;
  const operation=Promise.resolve().then(()=>{
   if(controller.signal.aborted)throw Error('QUOTE_CANCELLED');
   return request(controller.signal);
  }).finally(()=>{active--;});
  try{return await Promise.race([operation,deadline]);}
  finally{clearTimeout(timer);externalSignal?.removeEventListener('abort',cancel);}
 };
}
const withQuoteDeadline=createQuoteReader();
module.exports={centsFromInput,parseCountries,parseQuote,makeRequestGate,withQuoteDeadline,createQuoteReader};
