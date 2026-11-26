'use strict';
// Synthetic snapshot envelope validation. Never authorizes a payment.
const {reconcileStatements}=require('./reconcile-statements.cjs');
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function canonicalTime(value) {
  if(typeof value!=='string'||!ISO.test(value))return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)&&new Date(ms).toISOString()===value?ms:null;
}
function reconcileCut({environment,internal,provider}={}) {
  if(environment!=='sandbox')throw Error('SANDBOX_ONLY');
  const issues=[];
  const scope='US-HN:all-funding-payout-refund';
  for(const [side,s] of [['internal',internal],['provider',provider]]) {
    if(!s||s.mode!=='sandbox'||s.source!==side||s.scope!==scope||s.complete!==true||
       !Array.isArray(s.rows)||s.rows.length>100000) {
      issues.push({code:'INVALID_ENVELOPE',side});continue;
    }
    const start=canonicalTime(s.start),end=canonicalTime(s.end),captured=canonicalTime(s.capturedAt);
    if(start===null||end===null||captured===null||start>=end||captured<end)
      issues.push({code:'INVALID_CUT',side});
    if(!Number.isSafeInteger(s.declaredCount)||s.declaredCount!==s.rows.length)
      issues.push({code:'COUNT_MISMATCH',side});
  }
  if(!issues.length&&(internal.start!==provider.start||internal.end!==provider.end))
    issues.push({code:'CUT_MISMATCH'});
  if(issues.length)return {mode:'sandbox',clean:false,issues,matchedConfirmedNetMinor:null};
  return reconcileStatements({environment,internal:internal.rows,statement:provider.rows,complete:true});
}
module.exports={reconcileCut};
