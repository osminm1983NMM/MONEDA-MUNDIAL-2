'use strict';
// Fetch-compatible, read-only sandbox boundary. Does not start a server.
const {route}=require('./order-status-route.cjs');
const {validOrderStatus}=require('./order-status-contract.cjs');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const maxBody=1024;
function respond(status,body,extra={}){
 return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
}
const error=(status,code,extra)=>respond(status,{mode:'sandbox',error:code},extra);
function bounded(operation,ms,onTimeout=()=>{}){
 let timer;
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{
  reject(Error('DEADLINE'));onTimeout();
 },ms);});
 return Promise.race([operation,deadline]).finally(()=>clearTimeout(timer));
}
async function parseBody(request,timeoutMs){
 const reader=request.body?.getReader();
 if(!reader)throw Error('INVALID_REQUEST');
 const chunks=[];let length=0;
 const read=async()=>{
  try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>maxBody)throw Error('BODY_TOO_LARGE');
   chunks.push(value);
  }
 }catch(e){void reader.cancel().catch(()=>{});throw e;}
 finally{reader.releaseLock();}
  const raw=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.concat(chunks));
 // This endpoint has exactly one ASCII UUID field. Accept JSON whitespace,
 // but reject duplicated keys, escaped aliases and any ambiguous wire shape.
 if(!/^[ \t\r\n]*\{[ \t\r\n]*"orderId"[ \t\r\n]*:[ \t\r\n]*"[a-f0-9-]{36}"[ \t\r\n]*\}[ \t\r\n]*$/.test(raw))throw Error('INVALID_REQUEST');
 return JSON.parse(raw);
 };
 // Cancelling a Web Streams reader settles pending reads, even if its
 // underlying source takes longer to finish cancellation.
 return bounded(read(),timeoutMs,()=>{void reader.cancel().catch(()=>{});});
}
function createOrderStatusHttp({environment,service,bodyTimeoutMs=5000,serviceTimeoutMs=8000,maxActive=32}={}){
 if(environment!=='sandbox'||typeof service?.read!=='function')throw Error('SANDBOX_ONLY');
 if(![bodyTimeoutMs,serviceTimeoutMs].every(v=>Number.isInteger(v)&&v>=1&&v<=30000)||!Number.isInteger(maxActive)||maxActive<1||maxActive>256)throw Error('INVALID_HTTP_LIMITS');
 let active=0;
 return async request=>{
  if(!(request instanceof Request))return error(400,'INVALID_REQUEST');
  const url=new URL(request.url);
  if(url.pathname!==route)return error(404,'NOT_FOUND');
  if(url.search)return error(400,'INVALID_REQUEST');
  if(request.method!=='POST')return error(405,'METHOD_NOT_ALLOWED',{allow:'POST'});
  const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._~-]{1,8192})$/i)?.[1];
  if(!token)return error(401,'AUTH_REQUIRED',{'www-authenticate':'Bearer'});
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return error(415,'UNSUPPORTED_MEDIA_TYPE');
  const size=request.headers.get('content-length');
  if(size!==null&&(!/^\d{1,10}$/.test(size)||Number(size)>maxBody))return error(413,'BODY_TOO_LARGE');
  if(active>=maxActive){
   void request.body?.cancel().catch(()=>{});
   return error(503,'UNAVAILABLE');
  }
  active++;
  let retained=false;
  try{
  let body;
  try{body=await parseBody(request,bodyTimeoutMs);}catch(e){return e.message==='BODY_TOO_LARGE'?error(413,'BODY_TOO_LARGE'):e.message==='DEADLINE'?error(408,'INVALID_REQUEST'):error(400,'INVALID_REQUEST');}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||!Object.hasOwn(body,'orderId')||typeof body.orderId!=='string'||!uuid.test(body.orderId))return error(400,'INVALID_REQUEST');
  try{
   // A timed-out operation keeps its slot until actually settled. A broken
   // adapter cannot generate unbounded concurrent Auth or database calls.
   const operation=Promise.resolve().then(()=>service.read({sessionToken:token,orderId:body.orderId})).finally(()=>{active--;});
   retained=true;
   const result=await bounded(operation,serviceTimeoutMs);
   if(result?.status===200&&validOrderStatus(result.body,body.orderId))return respond(200,result.body);
   const allowed={400:'INVALID_REQUEST',401:'AUTH_REQUIRED',404:'NOT_FOUND',503:'UNAVAILABLE'};
   if(result&&Object.hasOwn(allowed,result.status))return error(result.status,allowed[result.status],result.status===401?{'www-authenticate':'Bearer'}:{});
  }catch{}
  return error(503,'UNAVAILABLE');
  }finally{if(!retained)active--;}
 };
}
module.exports={createOrderStatusHttp,route};
