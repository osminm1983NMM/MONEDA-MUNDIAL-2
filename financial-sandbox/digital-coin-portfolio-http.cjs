'use strict';
// Fetch-compatible sandbox wallet read boundary; no listener or production deployment.
function validPortfolio(x){
 const exact=(v,ks)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
 const units=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,24})$/.test(v);
 if(!exact(x,['mode','assets','pendingRedemptionUsdMinor','conversions'])||x.mode!=='sandbox'||!units(x.pendingRedemptionUsdMinor)||!Array.isArray(x.assets)||x.assets.length!==2||!Array.isArray(x.conversions)||x.conversions.length>2000)return false;
 for(const [i,asset] of ['DIGITAL_TEST','COIN_TEST'].entries()){
  const b=x.assets[i];
  if(!exact(b,['asset','availableMinor','reservedMinor','totalMinor'])||b.asset!==asset||![b.availableMinor,b.reservedMinor,b.totalMinor].every(units)||BigInt(b.availableMinor)+BigInt(b.reservedMinor)!==BigInt(b.totalMinor))return false;
 }
 const seen=new Set();
 for(const q of x.conversions){
  if(!exact(q,['quoteId','direction','digitalMinor','coinMinor','state','expiresAt'])||typeof q.quoteId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(q.quoteId)||seen.has(q.quoteId)||!['digital_to_coin','coin_to_digital'].includes(q.direction)||!['quoted','reserved','confirmed','cancelled'].includes(q.state)||![q.digitalMinor,q.coinMinor].every(units)||q.digitalMinor==='0'||q.coinMinor==='0'||!Number.isSafeInteger(q.expiresAt)||q.expiresAt<0)return false;
  seen.add(q.quoteId);
 }
 return true;
}
function createPortfolioHttp({environment,service,timeoutMs=8000,maxActive=32}={}){
 if(environment!=='sandbox'||typeof service?.read!=='function')throw Error('SANDBOX_ONLY');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000||!Number.isInteger(maxActive)||maxActive<1||maxActive>256)throw Error('INVALID_HTTP_LIMITS');
 const response=(status,body,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
 const error=(status,code,headers)=>response(status,{mode:'sandbox',error:code},headers);
 let active=0;
 return async request=>{
  if(!(request instanceof Request))return error(400,'INVALID_REQUEST');
  if(request.signal.aborted)return error(408,'INVALID_REQUEST');
  const url=new URL(request.url);
  if(url.pathname!=='/v1/sandbox/wallet/portfolio')return error(404,'NOT_FOUND');
  if(url.search||url.hash)return error(400,'INVALID_REQUEST');
  if(request.method!=='GET')return error(405,'METHOD_NOT_ALLOWED',{allow:'GET'});
  if(request.body!==null||request.headers.has('transfer-encoding')||(request.headers.has('content-length')&&request.headers.get('content-length')!=='0'))return error(400,'INVALID_REQUEST');
  const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._~-]{1,8192})$/i)?.[1];
  if(!token)return error(401,'AUTH_REQUIRED',{'www-authenticate':'Bearer'});
  if(active>=maxActive)return error(503,'UNAVAILABLE');
  const controller=new AbortController();
  let timer,abort;
  active++;
  const operation=Promise.resolve().then(()=>{
   if(controller.signal.aborted)throw Error('ABORTED');
   return service.read({sessionToken:token},controller.signal);
  }).finally(()=>{active--;});
  const deadline=new Promise((_,reject)=>{
   abort=()=>{controller.abort();reject(Error('ABORTED'));};
   timer=setTimeout(abort,timeoutMs);
   request.signal.addEventListener('abort',abort,{once:true});
   if(request.signal.aborted)abort();
  });
  try{
   const result=await Promise.race([operation,deadline]);
   if(request.signal.aborted)return error(408,'INVALID_REQUEST');
   if(result?.status===200&&validPortfolio(result.body))return response(200,result.body);
   if(result?.status===401)return error(401,'AUTH_REQUIRED',{'www-authenticate':'Bearer'});
   if(result?.status===400)return error(400,'INVALID_REQUEST');
   return error(503,'UNAVAILABLE');
  }catch{return request.signal.aborted?error(408,'INVALID_REQUEST'):error(503,'UNAVAILABLE');}
  finally{clearTimeout(timer);request.signal.removeEventListener('abort',abort);}
 };
}
module.exports={validPortfolio,createPortfolioHttp};
