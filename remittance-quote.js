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
 let generation=0, busy=false;
 return {begin(){if(busy)return null;busy=true;return ++generation;},isLatest(token){return busy&&token===generation;},finish(token){if(busy&&token===generation){busy=false;return true;}return false;},invalidate(){generation++;busy=false;}};
}
// A non-cooperative read must not leave the quote screen locked indefinitely.
// The losing promise stays observed; it cannot publish a late response.
async function withQuoteDeadline(request,timeoutMs=15000){
 if(typeof request!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('Invalid quote deadline');
 const controller=new AbortController();
 let timer;
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{
  reject(Error('QUOTE_TIMEOUT'));controller.abort();
 },timeoutMs);});
 try{return await Promise.race([Promise.resolve().then(()=>request(controller.signal)),deadline]);}
 finally{clearTimeout(timer);}
}
module.exports={centsFromInput,parseCountries,parseQuote,makeRequestGate,withQuoteDeadline};
