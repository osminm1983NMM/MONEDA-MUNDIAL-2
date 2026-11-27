'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {runProof}=require('../../financial-hosted/verify-https.cjs');
const fixtures=[{order:'A',total:'10150'},{order:'B',total:'20250'}];
function mock({leak=false,revocationFailure=false,anonAllowed=false,wrongAmount=false,sameUser=false,logoutError=false}={}){
 const revoked=new Set(), cleanup=[];
 return {cleanup,fixtures,anonRead:async()=>!anonAllowed,
  signIn:async f=>({token:f.order,userId:sameUser?'same':f.order,anonymous:false}),
  signOut:async s=>{cleanup.push(s.token);if(logoutError)throw Error('LOGOUT_FAILED');revoked.add(s.token);},
  read:async(t,o)=>((!revoked.has(t)||revocationFailure)&&(t===o||leak))?{ok:true,value:{status:'funding_pending',source:{totalMinor:wrongAmount?'1':fixtures.find(f=>f.order===o).total}}}:{ok:false,code:'NOT_FOUND'}};
}
test('hosted HTTPS harness accepts a complete isolated proof',async()=>{const m=mock();assert.match(await runProof(m),/^PASS:/);assert.ok(m.cleanup.includes('A')&&m.cleanup.includes('B'));});
for(const [name,options,error] of [
 ['cross account',{leak:true},/CROSS_ACCOUNT_NOT_DENIED/],
 ['revocation',{revocationFailure:true},/REVOKED_SESSION_NOT_DENIED/],
 ['anonymous',{anonAllowed:true},/ANONYMOUS_NOT_DENIED/],
 ['wrong amount',{wrongAmount:true},/OWNER_OR_AMOUNT_MISMATCH/],
 ['same user',{sameUser:true},/DISTINCT_USERS_REQUIRED/],
 ['logout failure',{logoutError:true},/LOGOUT_FAILED/]
])test('hosted HTTPS harness rejects '+name,async()=>{const m=mock(options);await assert.rejects(runProof(m),error);if(!options.anonAllowed)assert.ok(m.cleanup.includes('A')&&m.cleanup.includes('B'));});
