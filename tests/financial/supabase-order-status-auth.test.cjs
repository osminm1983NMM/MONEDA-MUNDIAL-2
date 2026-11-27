'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createSupabaseOrderStatus:create}=require('../../financial-sandbox/supabase-order-status-auth.cjs');
const id='00000000-0000-4000-8000-000000000010',victim='00000000-0000-4000-8000-000000000020',orderId='00000000-0000-4000-8000-000000000001';
const user={id,role:'authenticated',is_anonymous:false,user_metadata:{actor:victim},app_metadata:{actor:victim}};
const binding={environment:'sandbox',userId:id,actor:id,active:true};
const request={sessionToken:'opaque-fixture',orderId};
function fixture({response={data:{user},error:null},bound=binding,getUser,resolveBinding}={}){
 const calls=[];
 const service=create({environment:'sandbox',authClient:{auth:{async getUser(token){calls.push(['auth',token]);return getUser?getUser():response;}}},
 resolveBinding:async userId=>{calls.push(['binding',userId]);return resolveBinding?resolveBinding():bound;},
 query:async(sql,params)=>{calls.push(['query',params]);return {rows:[]};}});
 return {service,calls};
}
test('official auth method receives explicit token and only trusted UUID binding reaches SQL',async()=>{
 const f=fixture();a.equal((await f.service.read(request)).status,404);
 a.deepEqual(f.calls,[['auth',request.sessionToken],['binding',id],['query',[id,orderId]]]);
});
test('invalid tokens, anonymous users, wrong role and absent binding cannot query',async()=>{
 for(const response of [{error:{status:401}},{error:{status:403}},{data:{user:null}},{data:{user:{...user,is_anonymous:true}}},{data:{user:{...user,is_anonymous:undefined}}},{data:{user:{...user,role:'service_role'}}},{data:{user:{...user,id:'wrong'}}}]){
  const f=fixture({response});a.equal((await f.service.read(request)).status,401);a.equal(f.calls.length,1);
 }
 for(const bound of [null,{...binding,active:false}]){
  const f=fixture({bound});a.equal((await f.service.read(request)).status,401);a.equal(f.calls.length,2);
 }
 const f=fixture();a.equal((await f.service.read({...request,actor:victim})).status,400);a.equal(f.calls.length,0);
});
test('broken identity source, mismatched binding and upstream failure stop before query',async()=>{
 for(const bound of [{...binding,userId:victim},{...binding,actor:victim},{...binding,environment:'production'},{...binding,active:'true'},undefined]){
  if(bound===undefined)continue;
  const f=fixture({bound});a.equal((await f.service.read(request)).status,503);a.equal(f.calls.length,2);
 }
 for(const f of [fixture({response:{error:{status:429}}}),fixture({response:{error:{status:500}}}),fixture({getUser:()=>{throw Error('private upstream detail');}}),fixture({resolveBinding:()=>{throw Error('private registry detail');}})]){
  a.deepEqual(await f.service.read(request),{status:503,body:{mode:'sandbox',error:'UNAVAILABLE'}});
  a.ok(!f.calls.some(c=>c[0]==='query'));
 }
 a.throws(()=>create({environment:'production',authClient:{auth:{getUser(){}}},resolveBinding(){},query(){}}),/SANDBOX_ONLY/);
});
